import axiosInstance from "./axiosInstance"

const isFailureEnvelope = (body: any) => {
  const code = Number(body?.code ?? body?.statusCode)
  const info = String(body?.info ?? "").toUpperCase()

  return (
    body?.success === false ||
    info === "FAIL" ||
    (Number.isFinite(code) && code >= 400)
  )
}

const APICreateEmployee = async (data: any) => {
  try {
    const response = await axiosInstance.post("/employees/create", data)
    const body = response.data

    if (response.status === 201 || response.status === 200) {
      if (isFailureEnvelope(body)) {
        console.log("[employee create API] 2xx envelope mismatch", {
          request: data,
          status: response.status,
          body,
        })
      }

      return {
        data: body?.content ?? body?.data ?? (body?._id ? body : null),
        status: response.status,
      }
    }

    if (isFailureEnvelope(body)) {
      console.log("[employee create API] failure envelope", {
        request: data,
        status: response.status,
        body,
      })
    }

    return response
  } catch (err) {
    throw err
  }
}

const APIGetEmployees = async (params?: any) => {
  try {
    const response = await axiosInstance.get("/employees", { params })
    const body = response.data

    if (
      (response.status === 201 || response.status === 200) &&
      (body?.code === 200 || body?.statusCode === 200 || body?.success === true)
    ) {
      return {
        data: body?.content ?? body?.data ?? body,
        status: response.status,
        total: body?.total ?? body?.content?.total ?? body?.data?.total,
        page: body?.page ?? body?.content?.page ?? body?.data?.page,
        limit: body?.limit ?? body?.content?.limit ?? body?.data?.limit,
        totalPages:
          body?.totalPages ??
          body?.content?.totalPages ??
          body?.data?.totalPages,
      }
    }

    return response
  } catch (err) {
    console.error("Error during get employees:", err)
    throw err
  }
}

const APIGetEmployeeById = async (id: string) => {
  try {
    const response = await axiosInstance.get(`/employees/${id}`)

    if (
      (response.status === 201 || response.status === 200) &&
      (response.data?.code === 200 ||
        response.data?.statusCode === 200 ||
        response.data?.success === true)
    ) {
      return {
        data: response.data?.content ?? response.data?.data ?? response.data,
        status: response.status,
      }
    }

    return response
  } catch (err) {
    console.error("Error during get employee by id:", err)
    throw err
  }
}

const APIUpdateEmployee = async (id: string, data: any) => {
  try {
    const response = await axiosInstance.patch(`/employees/${id}`, data)

    if (
      (response.status === 201 || response.status === 200) &&
      (response.data?.code === 200 ||
        response.data?.statusCode === 200 ||
        response.data?.success === true)
    ) {
      return {
        data: response.data?.content ?? response.data?.data ?? response.data,
        status: response.status,
      }
    }

    return response
  } catch (err) {
    console.error("Error during update employee:", err)
    throw err
  }
}

const APIDeleteEmployee = async (id: string) => {
  try {
    const response = await axiosInstance.delete(`/employees/${id}`)

    if (response.status === 204) {
      return { data: null, status: 204 }
    }

    if (
      (response.status === 201 || response.status === 200) &&
      (response.data?.code === 200 ||
        response.data?.statusCode === 200 ||
        response.data?.success === true)
    ) {
      return {
        data: response.data?.content ?? response.data?.data ?? response.data,
        status: response.status,
      }
    }

    return response
  } catch (err) {
    console.error("Error during delete employee:", err)
    throw err
  }
}

export {
  APICreateEmployee,
  APIGetEmployees,
  APIGetEmployeeById,
  APIUpdateEmployee,
  APIDeleteEmployee,
}
