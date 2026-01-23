export type TemplateConfig = {
  id: string
  title: string
  desc: string
  filePath: string // absolute path
}

export const TEMPLATES: TemplateConfig[] = [
  {
    id: "vacom-hd",
    title: "VACOM HD",
    desc: "Xuất theo mẫu VACOM HD",
    filePath: "/mnt/data/các mẫu đối soát_v215.xlsx",
  },
  {
    id: "chi-hoa-hong",
    title: "Mẫu chi hoa hồng",
    desc: "Xuất file chi hoa hồng",
    filePath: "/mnt/data/các mẫu đối soát_v215.xlsx",
  },
  {
    id: "thu-gia-von",
    title: "Mẫu thu giá vốn",
    desc: "Xuất thu giá vốn theo danh mục/đại lý",
    filePath: "/mnt/data/các mẫu đối soát_v215.xlsx",
  },
]
