import axiosInstance from "./axiosInstance"

const APICreateAgency = async (data: any) => {
  try {
    const response = await axiosInstance.post("/agencies/create", data)

    if (
      (response.status === 201 || response.status === 200) &&
      response.data?.code === 200
    ) {
      return {
        data: response.data?.content ?? response.data?.data ?? null,
        status: response.status,
      }
    }

    return response
  } catch (err) {
    console.error("Error during create agency:", err)
    throw err
  }
}

const APIGetAgencies = async () => {
  try {
    const response = await axiosInstance.get("/agencies")

    if (
      (response.status === 201 || response.status === 200) &&
      response.data?.code === 200
    ) {
      return {
        data: Array.isArray(response.data?.data) ? response.data.data : [],
        status: response.status,
        total: response.data?.total ?? 0,
        page: response.data?.page ?? 1,
        limit: response.data?.limit ?? 10,
        totalPages: response.data?.totalPages ?? 1,
      }
    }

    return {
      data: [],
      status: response.status,
    }
  } catch (err) {
    console.error("Error during get agencies:", err)
    throw err
  }
}

const APIGetAgencyById = async (id: string) => {
  try {
    const response = await axiosInstance.get(`/agencies/${id}`)

    if (
      (response.status === 201 || response.status === 200) &&
      response.data?.code === 200
    ) {
      return {
        data: response.data?.content ?? response.data?.data ?? null,
        status: response.status,
      }
    }

    return {
      data: null,
      status: response.status,
    }
  } catch (err) {
    console.error("Error during get agency by id:", err)
    throw err
  }
}

const APIUpdateAgency = async (id: string, data: any) => {
  try {
    const response = await axiosInstance.patch(`/agencies/${id}`, data)

    if (
      (response.status === 201 || response.status === 200) &&
      response.data?.code === 200
    ) {
      return {
        data: response.data?.content ?? response.data?.data ?? null,
        status: response.status,
      }
    }

    return response
  } catch (err) {
    console.error("Error during update agency:", err)
    throw err
  }
}

const APIDeleteAgency = async (id: string) => {
  try {
    const response = await axiosInstance.delete(`/agencies/${id}`)

    if (response.status === 204) {
      return { data: null, status: 204 }
    }

    if (
      (response.status === 201 || response.status === 200) &&
      response.data?.code === 200
    ) {
      return {
        data: response.data?.content ?? response.data?.data ?? null,
        status: response.status,
      }
    }

    return response
  } catch (err) {
    console.error("Error during delete agency:", err)
    throw err
  }
}

export {
  APICreateAgency,
  APIGetAgencies,
  APIGetAgencyById,
  APIUpdateAgency,
  APIDeleteAgency,
}
