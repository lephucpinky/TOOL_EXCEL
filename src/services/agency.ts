import type { Agency, AgencyPayload } from "@/types/agency"
import { fetchAllPages } from "@/utils/pagination"
import axiosInstance from "./axiosInstance"

type AgencyRequestPayload = AgencyPayload
type AgencyListParams = Record<string, string | number | boolean | undefined>

const APICreateAgency = async (data: AgencyRequestPayload) => {
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
}

const APIGetAgencies = async (params?: AgencyListParams) => {
  const response = await axiosInstance.get("/agencies", { params })

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
}

const APIGetAllAgencies = async (params?: AgencyListParams) => {
  const data = await fetchAllPages<Agency, AgencyListParams>(
    APIGetAgencies,
    params,
    { pageSize: 100 }
  )

  return { data, status: 200 }
}

const APIGetAgencyById = async (id: string) => {
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
}

const APIUpdateAgency = async (id: string, data: AgencyRequestPayload) => {
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
}

const APIDeleteAgency = async (id: string) => {
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
}

export {
  APICreateAgency,
  APIGetAgencies,
  APIGetAllAgencies,
  APIGetAgencyById,
  APIUpdateAgency,
  APIDeleteAgency,
}
