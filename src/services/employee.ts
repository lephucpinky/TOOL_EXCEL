import axiosInstance from "./axiosInstance"

const APICreateEmployee = async (data: any) => {
  try {
    const response = await axiosInstance.post("/employees/create", data)

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
    console.error("Error during create employee:", err)
    throw err
  }
}

const APIGetEmployees = async (params?: any) => {
  try {
    const response = await axiosInstance.get("/employees", { params })

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
