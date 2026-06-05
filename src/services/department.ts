import axiosInstance from "./axiosInstance"

const APICreateDepartment = async (data: any) => {
  try {
    const response = await axiosInstance.post("/departments/create", data)

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
    console.error("Error during create department:", err)
    throw err
  }
}

const APIGetDepartments = async (params?: any) => {
  try {
    const response = await axiosInstance.get("/departments", { params })
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
    console.error("Error during get departments:", err)
    throw err
  }
}

const APIGetDepartmentById = async (id: string) => {
  try {
    const response = await axiosInstance.get(`/departments/${id}`)

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
    console.error("Error during get department by id:", err)
    throw err
  }
}

const APIUpdateDepartment = async (id: string, data: any) => {
  try {
    const response = await axiosInstance.patch(`/departments/${id}`, data)

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
    console.error("Error during update department:", err)
    throw err
  }
}

const APIDeleteDepartment = async (id: string) => {
  try {
    const response = await axiosInstance.delete(`/departments/${id}`)

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
    console.error("Error during delete department:", err)
    throw err
  }
}

export {
  APICreateDepartment,
  APIGetDepartments,
  APIGetDepartmentById,
  APIUpdateDepartment,
  APIDeleteDepartment,
}
