import axios from "axios"

const axiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 100000,
})

let isRefreshing = false
let failedQueue: any[] = []

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })

  isRefreshing = false
  failedQueue = []
}

axiosInstance.interceptors.request.use(
  (config) => {
    const secretKey = process.env.NEXT_PUBLIC_SECRET_KEY

    if (typeof window !== "undefined") {
      const token = localStorage.getItem("access_token")

      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }

    if (secretKey) {
      config.headers["x-secret-key"] = secretKey
    }

    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      typeof window !== "undefined"
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return axiosInstance(originalRequest)
          })
          .catch((err) => {
            return Promise.reject(err)
          })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem("refresh_token")

        if (!refreshToken) {
          throw new Error("No refresh token available")
        }

        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
          { refreshToken },
          {
            headers: {
              "x-secret-key": process.env.NEXT_PUBLIC_SECRET_KEY,
            },
          }
        )

        const newToken =
          response.data?.content?.access_token ||
          response.data?.content?.accessToken ||
          response.data?.access_token ||
          response.data?.accessToken

        if (newToken) {
          localStorage.setItem("access_token", newToken)
          axiosInstance.defaults.headers.common.Authorization = `Bearer ${newToken}`
          originalRequest.headers.Authorization = `Bearer ${newToken}`

          processQueue(null, newToken)

          return axiosInstance(originalRequest)
        } else {
          throw new Error("No token in refresh response")
        }
      } catch (err) {
        processQueue(err, null)

        if (typeof window !== "undefined") {
          localStorage.removeItem("access_token")
          localStorage.removeItem("refresh_token")
          window.location.href = "/"
        }

        return Promise.reject(err)
      }
    }

    if (error.response?.status === 403) {
      console.error("Forbidden - access denied:", error.response?.data)
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token")
        localStorage.removeItem("refresh_token")
        window.location.href = "/"
      }
    }

    return Promise.reject(error)
  }
)

export default axiosInstance
