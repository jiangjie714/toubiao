export type VolumeId =
  | "VOL_1_COMMERCIAL"
  | "VOL_2_QUALIFICATION"
  | "VOL_3_CASE"
  | "VOL_4_TECHNICAL"
  | "VOL_5_COMPLIANCE"
  | "VOL_6_SERVICE";

export interface VolumeMeta {
  id: VolumeId;
  volumeNumber: string;
  title: string;
  shortTitle: string;
  description: string;
  badgeCls: string;
}

export const VOLUME_METAS: Record<VolumeId, VolumeMeta> = {
  VOL_1_COMMERCIAL: {
    id: "VOL_1_COMMERCIAL",
    volumeNumber: "第一卷",
    title: "商务报价与法定承诺函卷",
    shortTitle: "商务承诺卷",
    description: "投标函、法定代表人身份证明与授权委托书、保证金凭据说明与中小企业声明函。",
    badgeCls: "bg-blue-100 text-blue-800 border-blue-200",
  },
  VOL_2_QUALIFICATION: {
    id: "VOL_2_QUALIFICATION",
    volumeNumber: "第二卷",
    title: "法定资格证明与信誉合规卷",
    shortTitle: "资格资质卷",
    description: "营业执照、财务状况良好声明、依法纳税社保声明、信用中国合规与资质证书自动挂接。",
    badgeCls: "bg-emerald-100 text-emerald-800 border-emerald-200",
  },
  VOL_3_CASE: {
    id: "VOL_3_CASE",
    volumeNumber: "第三卷",
    title: "同类类似项目业绩与证明材料卷",
    shortTitle: "类似业绩卷",
    description: "从企业案例库中按招标行业与体量自动优选 3-5 笔历史成功案例与合同证明材料索引。",
    badgeCls: "bg-amber-100 text-amber-800 border-amber-200",
  },
  VOL_4_TECHNICAL: {
    id: "VOL_4_TECHNICAL",
    volumeNumber: "第四卷",
    title: "技术方案与项目实施组织卷",
    shortTitle: "技术方案卷",
    description: "系统整体架构设计、实施部署网络拓扑、进度计划里程碑甘特表、项目组织与人员分工。",
    badgeCls: "bg-indigo-100 text-indigo-800 border-indigo-200",
  },
  VOL_5_COMPLIANCE: {
    id: "VOL_5_COMPLIANCE",
    volumeNumber: "第五卷",
    title: "实质性条款与点对点偏离应答表",
    shortTitle: "逐条应答卷",
    description: "针对招标文件资格、商务与全部技术参数的完全响应承诺、无负偏离矩阵与证明索引。",
    badgeCls: "bg-purple-100 text-purple-800 border-purple-200",
  },
  VOL_6_SERVICE: {
    id: "VOL_6_SERVICE",
    volumeNumber: "第六卷",
    title: "售后服务保障与应急响应卷",
    shortTitle: "售后运维卷",
    description: "7×24h 应急响应机制、属地化运维常驻保障承诺、技术培训与移交交付保障体系。",
    badgeCls: "bg-rose-100 text-rose-800 border-rose-200",
  },
};

export interface AssembledVolumeItem {
  volumeId: VolumeId;
  title: string;
  contentMarkdown: string;
  isReady: boolean;
  metaSummary: string;
  matchedAssetsCount?: number;
}

export interface ProposalProjectData {
  id: number;
  title: string;
  status: "DRAFT" | "COMPLETED" | "AUDITED";
  targetPurchaser: string | null;
  bidAmountWan: number | null;
  projectDuration: string | null;
  tenderId: number | null;
  followId: number | null;
  createdAt: string;
  updatedAt: string;
  volumes: AssembledVolumeItem[];
  completionRate: number; // 0 - 100
}
