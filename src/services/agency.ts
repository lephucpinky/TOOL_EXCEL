import axiosInstance from "./axiosInstance"

const APICreateAgency = async (data: any) => {
  try {
    const response = await axiosInstance.post("/agencies/create", data)
    if (
      (response.status === 201 || response.status === 200) &&
      response.data.code === 200
    ) {
      return { data: response.data.content, status: response.status }
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
      response.data.code === 200
    ) {
      return { data: response.data.content, status: response.status }
    }
    return response
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
      response.data.code === 200
    ) {
      return { data: response.data.content, status: response.status }
    }
    return response
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
      response.data.code === 200
    ) {
      return { data: response.data.content, status: response.status }
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
    console.log("=== APIDeleteAgency raw response ===", response)

    // 204 No Content - thành công
    if (response.status === 204) {
      return { data: null, status: 204 }
    }

    // 200/201 với code 200
    if (
      (response.status === 201 || response.status === 200) &&
      response.data.code === 200
    ) {
      return { data: response.data.content, status: response.status }
    }

    console.log("=== APIDeleteAgency returning response as-is ===", response)
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
