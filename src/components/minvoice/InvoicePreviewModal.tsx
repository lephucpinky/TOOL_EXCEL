// "use client"

// export type PreviewInvoiceItem = {
//   id: string
//   code: string
//   name: string
//   unit: string
//   quantity: number
//   type: string
//   unitPrice: number
//   amount: number
//   taxRate: number
//   taxAmount: number
//   totalAmount: number
// }

// export type PreviewInvoiceData = {
//   symbol: string
//   invoiceDate: string
//   invoiceNo: string
//   currency: string
//   exchangeRate: number
//   paymentMethod: string
//   seller: {
//     taxCode: string
//     name: string
//     address: string
//     email: string
//     phone: string
//     bankName: string
//   }
//   buyer: {
//     taxCode: string
//     companyName: string
//     email: string
//     address: string
//   }
//   items: PreviewInvoiceItem[]
//   totalBeforeTax: number
//   totalTax: number
//   totalPayment: number
//   amountInWords: string
// }

// type Props = {
//   open: boolean
//   data: PreviewInvoiceData | null
//   onClose: () => void
// }

// function formatMoney(value: number) {
//   return new Intl.NumberFormat("vi-VN").format(
//     Number.isFinite(value) ? value : 0
//   )
// }

// function formatDateVN(value: string) {
//   if (!value) return ""
//   const [year, month, day] = value.split("-")
//   if (!year || !month || !day) return value
//   return `${day}/${month}/${year}`
// }

// export default function InvoicePreviewModal({ open, data, onClose }: Props) {
//   if (!open || !data) return null

//   return (
//     <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/45 p-4">
//       <div className="flex max-h-[94vh] w-full max-w-[980px] flex-col overflow-hidden rounded bg-white shadow-2xl">
//         <div className="flex items-center justify-between border-b border-slate-200 bg-[#f8fafc] px-4 py-3">
//           <div className="flex items-center gap-2 text-sm text-slate-600">
//             <button className="px-2 text-lg">«</button>
//             <button className="px-2 text-lg">‹</button>
//             <span className="bg-indigo-50 text-indigo-700 rounded px-3 py-1 font-semibold">
//               1
//             </span>
//             <button className="px-2 text-lg">›</button>
//             <button className="px-2 text-lg">»</button>
//           </div>

//           <div className="flex items-center gap-2">
//             <button className="border-indigo-400 text-indigo-700 rounded border bg-white px-3 py-1.5 text-sm font-medium">
//               ⚙ Cấu hình
//             </button>
//             <button className="border-indigo-400 text-indigo-700 rounded border bg-white px-3 py-1.5 text-sm font-medium">
//               ⎙ In HĐ
//             </button>
//             <button className="border-indigo-400 text-indigo-700 rounded border bg-white px-3 py-1.5 text-sm font-medium">
//               ⇩ Tải PDF
//             </button>
//             <button className="border-indigo-400 text-indigo-700 rounded border bg-white px-3 py-1.5 text-sm font-medium">
//               ⊞ Chức năng
//             </button>
//             <button
//               onClick={onClose}
//               className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-xl text-slate-500 hover:bg-slate-100"
//             >
//               ×
//             </button>
//           </div>
//         </div>

//         <div className="overflow-auto bg-[#edf1f4] p-5">
//           <div className="mx-auto min-h-[1080px] w-[820px] bg-white p-7 shadow-xl">
//             <div className="border-emerald-200 relative min-h-[1020px] border-[5px] border-double px-5 py-5 text-[14px] text-[#000066]">
//               <div className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-[0.06]">
//                 <div className="h-[430px] w-[430px] rounded-full border-[70px] border-red-500" />
//               </div>

//               <div className="relative">
//                 <div className="flex items-start gap-4">
//                   <div className="flex h-[110px] w-[150px] items-center justify-center rounded-full bg-red-600 text-center text-2xl font-black text-white">
//                     M
//                   </div>

//                   <div className="flex-1 text-center">
//                     <div className="text-[15px] font-bold uppercase text-red-600">
//                       {data.seller.name}
//                     </div>
//                     <div>
//                       <b>Địa chỉ</b> <i>(Address):</i> {data.seller.address}
//                     </div>
//                     <div>
//                       <b>Mã số thuế</b> <i>(Tax code):</i>{" "}
//                       <b>{data.seller.taxCode}</b>
//                     </div>
//                     <div>
//                       <b>Số tài khoản</b> <i>(A/C No):</i>{" "}
//                       {data.seller.bankName}
//                     </div>
//                     <div>
//                       <b>Mô tả</b> <i>(At):</i> {data.seller.bankName}
//                     </div>
//                   </div>
//                 </div>

//                 <div className="bg-gradient-to-r mt-2 h-[5px] from-red-600 via-red-600 to-blue-700" />

//                 <div className="mt-3 grid grid-cols-3 items-start">
//                   <div />
//                   <div className="text-center">
//                     <div className="text-[18px] font-bold uppercase text-red-600">
//                       HÓA ĐƠN GIÁ TRỊ GIA TĂNG
//                     </div>
//                     <div className="text-[15px] font-bold italic text-red-600">
//                       VAT INVOICE
//                     </div>
//                     <div className="mt-1">
//                       (Bản thể hiện của hóa đơn điện tử)
//                     </div>
//                     <div className="mt-1">
//                       Ngày <i>(date)</i> <b>{data.invoiceDate.slice(8, 10)}</b>{" "}
//                       tháng <i>(month)</i> <b>{data.invoiceDate.slice(5, 7)}</b>{" "}
//                       năm <i>(year)</i> <b>{data.invoiceDate.slice(0, 4)}</b>
//                     </div>
//                     <div className="mt-1">
//                       <b>Mã của cơ quan thuế:</b> M1-26-UNSWC-0000023137
//                     </div>
//                   </div>

//                   <div className="pl-8 text-left">
//                     <div>
//                       Ký hiệu <i>(Serial No):</i>{" "}
//                       <b className="text-[16px]">{data.symbol}</b>
//                     </div>
//                     <div>
//                       Số <i>(No):</i>{" "}
//                       <b className="text-[16px] text-red-600">
//                         {data.invoiceNo || "___"}
//                       </b>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="mt-6 space-y-2">
//                   <div>
//                     Họ tên người mua hàng <i>(Buyer’s fullname):</i> Khách lẻ
//                   </div>
//                   <div>
//                     Tên đơn vị <i>(Company’s name):</i> {data.buyer.companyName}
//                   </div>
//                   <div>
//                     Địa chỉ <i>(Address):</i> {data.buyer.address}
//                   </div>
//                   <div>
//                     Mã số thuế <i>(Tax code):</i> {data.buyer.taxCode}
//                   </div>
//                   <div>
//                     Hình thức thanh toán <i>(Payment method):</i>{" "}
//                     {data.paymentMethod}
//                   </div>
//                   <div>
//                     Email <i>(Email):</i> {data.buyer.email}
//                   </div>
//                 </div>

//                 <table className="mt-4 w-full border-collapse text-[13px]">
//                   <thead>
//                     <tr>
//                       <th className="border border-black px-2 py-2 text-center">
//                         STT
//                         <br />
//                         <i>(No)</i>
//                       </th>
//                       <th className="border border-black px-2 py-2 text-center">
//                         Tên hàng hóa, dịch vụ
//                         <br />
//                         <i>(Description)</i>
//                       </th>
//                       <th className="border border-black px-2 py-2 text-center">
//                         ĐVT
//                         <br />
//                         <i>(Unit)</i>
//                       </th>
//                       <th className="border border-black px-2 py-2 text-center">
//                         Số lượng
//                         <br />
//                         <i>(Quantity)</i>
//                       </th>
//                       <th className="border border-black px-2 py-2 text-center">
//                         Đơn giá
//                         <br />
//                         <i>(Unit price)</i>
//                       </th>
//                       <th className="border border-black px-2 py-2 text-center">
//                         Thành tiền
//                         <br />
//                         chưa có thuế VAT
//                       </th>
//                       <th className="border border-black px-2 py-2 text-center">
//                         Thuế suất
//                         <br />
//                         <i>(VAT rate)</i>
//                       </th>
//                       <th className="border border-black px-2 py-2 text-center">
//                         Tiền thuế
//                         <br />
//                         <i>(VAT amount)</i>
//                       </th>
//                       <th className="border border-black px-2 py-2 text-center">
//                         Thành tiền
//                         <br />
//                         có thuế GTGT
//                       </th>
//                     </tr>
//                   </thead>

//                   <tbody>
//                     <tr>
//                       {[
//                         "1",
//                         "2",
//                         "3",
//                         "4",
//                         "5",
//                         "6 = 4 x 5",
//                         "7",
//                         "8 = 6 x 7",
//                         "9 = 6 + 8",
//                       ].map((item) => (
//                         <td
//                           key={item}
//                           className="border border-black px-2 py-2 text-center"
//                         >
//                           {item}
//                         </td>
//                       ))}
//                     </tr>

//                     {data.items.map((item, index) => (
//                       <tr key={item.id}>
//                         <td className="border border-black px-2 py-2 text-center">
//                           {index + 1}
//                         </td>
//                         <td className="border border-black px-2 py-2 font-bold">
//                           {item.name}
//                         </td>
//                         <td className="border border-black px-2 py-2 text-center">
//                           {item.unit}
//                         </td>
//                         <td className="border border-black px-2 py-2 text-right">
//                           {formatMoney(item.quantity)}
//                         </td>
//                         <td className="border border-black px-2 py-2 text-right">
//                           {formatMoney(item.unitPrice)}
//                         </td>
//                         <td className="border border-black px-2 py-2 text-right">
//                           {formatMoney(item.amount)}
//                         </td>
//                         <td className="border border-black px-2 py-2 text-center">
//                           {item.taxRate}%
//                         </td>
//                         <td className="border border-black px-2 py-2 text-right">
//                           {formatMoney(item.taxAmount)}
//                         </td>
//                         <td className="border border-black px-2 py-2 text-right">
//                           {formatMoney(item.totalAmount)}
//                         </td>
//                       </tr>
//                     ))}

//                     {Array.from({
//                       length: Math.max(5 - data.items.length, 0),
//                     }).map((_, index) => (
//                       <tr key={`empty-${index}`}>
//                         <td className="border border-black py-4" />
//                         <td className="border border-black py-4" />
//                         <td className="border border-black py-4" />
//                         <td className="border border-black py-4" />
//                         <td className="border border-black py-4" />
//                         <td className="border border-black py-4" />
//                         <td className="border border-black py-4" />
//                         <td className="border border-black py-4" />
//                         <td className="border border-black py-4" />
//                       </tr>
//                     ))}

//                     <tr>
//                       <td
//                         colSpan={6}
//                         className="border border-black px-2 py-2 text-right"
//                       >
//                         Tổng tiền chưa thuế GTGT <i>(Total amount):</i>
//                       </td>
//                       <td
//                         colSpan={3}
//                         className="border border-black px-2 py-2 text-right font-bold"
//                       >
//                         {formatMoney(data.totalBeforeTax)}
//                       </td>
//                     </tr>
//                     <tr>
//                       <td
//                         colSpan={6}
//                         className="border border-black px-2 py-2 text-right"
//                       >
//                         Tổng tiền thuế GTGT <i>(VAT amount):</i>
//                       </td>
//                       <td
//                         colSpan={3}
//                         className="border border-black px-2 py-2 text-right font-bold"
//                       >
//                         {formatMoney(data.totalTax)}
//                       </td>
//                     </tr>
//                     <tr>
//                       <td
//                         colSpan={6}
//                         className="border border-black px-2 py-2 text-right"
//                       >
//                         Tổng cộng tiền thanh toán <i>(Total payment):</i>
//                       </td>
//                       <td
//                         colSpan={3}
//                         className="border border-black px-2 py-2 text-right font-bold"
//                       >
//                         {formatMoney(data.totalPayment)}
//                       </td>
//                     </tr>
//                   </tbody>
//                 </table>

//                 <div className="border-x border-b border-black px-2 py-2 font-bold">
//                   Số tiền viết bằng chữ <i>(In words):</i> {data.amountInWords}
//                 </div>

//                 <div className="mt-4 grid grid-cols-2 text-center">
//                   <div>
//                     <div className="font-bold">
//                       Người mua hàng <i>(Buyer)</i>
//                     </div>
//                     <div>
//                       <i>Ký, ghi rõ họ tên</i>
//                     </div>
//                     <div className="mt-1">
//                       <i>(Sign, Fullname)</i>
//                     </div>
//                   </div>

//                   <div>
//                     <div className="font-bold">
//                       Người bán hàng <i>(Seller)</i>
//                     </div>
//                     <div>
//                       <i>Ký, ghi rõ họ tên</i>
//                     </div>
//                     <div className="mt-1">
//                       <i>(Sign, Fullname)</i>
//                     </div>

//                     <div className="mx-auto mt-6 w-[330px] border border-green-500 px-4 py-3 text-left text-green-600">
//                       <div className="font-bold">Signature valid</div>
//                       <div>Được ký bởi: {data.seller.name}</div>
//                       <div>Ngày ký: {formatDateVN(data.invoiceDate)}</div>
//                     </div>
//                   </div>
//                 </div>

//                 <div className="absolute bottom-8 left-0 right-0 text-center text-[12px]">
//                   Tra hóa đơn tại website:{" "}
//                   <b>https://tracuuhoadon.minvoice.vn</b> - Mã tra cứu:{" "}
//                   <b>7BEDD4B</b>
//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>

//         <div className="flex justify-center gap-2 border-t border-slate-200 bg-white px-4 py-3">
//           <button
//             onClick={onClose}
//             className="rounded border border-slate-400 bg-white px-5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
//           >
//             Đóng
//           </button>
//         </div>
//       </div>
//     </div>
//   )
// }
