import axiosInstance from "./axiosInstance"

const normalizeResponse = (response: any) => {
  return {
    data:
      response?.data?.content ??
      response?.data?.data ??
      response?.data?.result ??
      response?.data,
    status: response?.status,
  }
}

const APICreateSaleTransaction = async (data: any) => {
  try {
    const response = await axiosInstance.post("/sale-transaction/create", data)

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during create sale transaction:", err)
    throw err
  }
}

const APIGetSaleTransactions = async (params?: any) => {
  try {
    const response = await axiosInstance.get("/sale-transaction", { params })

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during get sale transactions:", err)
    throw err
  }
}

const APIGetSaleTransactionStats = async () => {
  try {
    const response = await axiosInstance.get("/sale-transaction/stats")

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during get sale transaction stats:", err)
    throw err
  }
}

const APISearchSaleTransactionsByDateRange = async (params: {
  startDate: string
  endDate: string
}) => {
  try {
    const response = await axiosInstance.get(
      "/sale-transaction/search/date-range",
      { params }
    )

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during search sale transactions by date range:", err)
    throw err
  }
}

const APIGetSaleTransactionsByEmployee = async (employeeId: string) => {
  try {
    const response = await axiosInstance.get(
      `/sale-transaction/by-employee/${employeeId}`
    )

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during get sale transactions by employee:", err)
    throw err
  }
}

const APIGetSaleTransactionsByAgency = async (agencyId: string) => {
  try {
    const response = await axiosInstance.get(
      `/sale-transaction/by-agency/${agencyId}`
    )

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during get sale transactions by agency:", err)
    throw err
  }
}

const APIGetSaleTransactionsByDepartment = async (departmentId: string) => {
  try {
    const response = await axiosInstance.get(
      `/sale-transaction/by-department/${departmentId}`
    )

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during get sale transactions by department:", err)
    throw err
  }
}

const APIGetSaleTransactionById = async (id: string) => {
  try {
    const response = await axiosInstance.get(`/sale-transaction/${id}`)

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during get sale transaction by id:", err)
    throw err
  }
}

const APIUpdateSaleTransaction = async (id: string, data: any) => {
  try {
    const response = await axiosInstance.put(`/sale-transaction/${id}`, data)

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during update sale transaction:", err)
    throw err
  }
}

const APIUpdateSaleTransactionBank = async (
  id: string,
  data: { bankId: string } | string
) => {
  try {
    const body = typeof data === "string" ? { bankId: data } : data
    const response = await axiosInstance.patch(
      `/sale-transaction/${id}/bank`,
      body
    )

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during update sale transaction bank:", err)
    throw err
  }
}

const APIDeleteSaleTransaction = async (id: string) => {
  try {
    const response = await axiosInstance.delete(`/sale-transaction/${id}`)

    if (response.status === 204) {
      return { data: null, status: 204 }
    }

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during delete sale transaction:", err)
    throw err
  }
}

const APISendSaleTransactionReceipt = async (id: string) => {
  try {
    const response = await axiosInstance.post(
      `/sale-transaction/${id}/send-receipt`
    )

    if (response.status >= 200 && response.status < 300) {
      return normalizeResponse(response)
    }

    return response
  } catch (err) {
    console.error("Error during send sale transaction receipt:", err)
    throw err
  }
}

export {
  APICreateSaleTransaction,
  APIGetSaleTransactions,
  APIGetSaleTransactionStats,
  APISearchSaleTransactionsByDateRange,
  APIGetSaleTransactionsByEmployee,
  APIGetSaleTransactionsByAgency,
  APIGetSaleTransactionsByDepartment,
  APIGetSaleTransactionById,
  APIUpdateSaleTransaction,
  APIUpdateSaleTransactionBank,
  APIDeleteSaleTransaction,
  APISendSaleTransactionReceipt,
}
