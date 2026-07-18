import axiosInstance from "./axiosInstance"

const APICreateEmployee = async (data: any) => {
  const response = await axiosInstance.post("/employees/create", data)
  const body = response.data

  if (response.status === 201 || response.status === 200) {
    return {
      data: body?.content ?? body?.data ?? (body?._id ? body : null),
      status: response.status,
    }
  }

  return response
}

const APIGetEmployees = async (params?: any) => {
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
        body?.totalPages ?? body?.content?.totalPages ?? body?.data?.totalPages,
    }
  }

  return response
}

const APIGetEmployeeById = async (id: string) => {
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
}

const APIUpdateEmployee = async (id: string, data: any) => {
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
}

const APIDeleteEmployee = async (id: string) => {
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
}

export {
  APICreateEmployee,
  APIGetEmployees,
  APIGetEmployeeById,
  APIUpdateEmployee,
  APIDeleteEmployee,
}
