import axiosInstance from "./axiosInstance"

const APICreateProduct = async (data: any) => {
  try {
    const response = await axiosInstance.post("/products/create", data)

    if (
      (response.status === 201 || response.status === 200) &&
      (response.data?.code === 200 ||
        response.data?.statusCode === 200 ||
        response.data?.statusCode === 201 ||
        response.data?.success === true)
    ) {
      return {
        data: response.data?.content ?? response.data?.data ?? response.data,
        status: response.status,
      }
    }

    return response
  } catch (err) {
    console.error("Error during create product:", err)
    throw err
  }
}

const APIGetProducts = async (params?: any) => {
  try {
    const response = await axiosInstance.get("/products", { params })
    const body = response.data

    if (
      (response.status === 201 || response.status === 200) &&
      (body?.code === 200 ||
        body?.statusCode === 200 ||
        body?.success === true)
    ) {
      return {
        data: body?.content ?? body?.data ?? body,
        status: response.status,
        total: body?.total ?? body?.content?.total ?? body?.data?.total,
        page: body?.page ?? body?.content?.page ?? body?.data?.page,
        limit: body?.limit ?? body?.content?.limit ?? body?.data?.limit,
        totalPages:
          body?.totalPages ?? body?.content?.totalPages ?? body?.data?.totalPages,
      }
    }

    return response
  } catch (err) {
    console.error("Error during get products:", err)
    throw err
  }
}

const APIGetProductById = async (id: string) => {
  try {
    const response = await axiosInstance.get(`/products/${id}`)

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
    console.error("Error during get product by id:", err)
    throw err
  }
}

const APIUpdateProduct = async (id: string, data: any) => {
  try {
    const response = await axiosInstance.patch(`/products/${id}`, data)

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
    console.error("Error during update product:", err)
    throw err
  }
}

const APIDeleteProduct = async (id: string) => {
  try {
    const response = await axiosInstance.delete(`/products/${id}`)

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
    console.error("Error during delete product:", err)
    throw err
  }
}

export {
  APICreateProduct,
  APIGetProducts,
  APIGetProductById,
  APIUpdateProduct,
  APIDeleteProduct,
}
