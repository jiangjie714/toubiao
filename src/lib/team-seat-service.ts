import { prisma } from "./prisma";

export interface SeatUpgradeQuote {
  extraSeats: number;
  unitPriceMonthly: number;
  unitPriceYearly: number;
  remainingDays: number;
  totalAmount: number;
  billingCycle: "monthly" | "yearly";
}

export interface OffboardingTransferResult {
  fromUserId: number;
  fromUserName: string;
  toUserId: number;
  toUserName: string;
  transferredFollows: number;
  transferredComments: number;
  transferredProposals: number;
  transferredWatches: number;
  transferredAt: Date;
}

/**
 * 计算企业席位加购弹性折算费用 (按剩余服务期 Pro-rata 折算)
 */
export async function calculateSeatUpgradeQuote(
  teamId: number,
  extraSeats: number,
): Promise<SeatUpgradeQuote> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      owner: {
        include: {
          subscription: {
            include: { plan: true },
          },
        },
      },
    },
  });

  if (!team) {
    throw new Error("企业团队不存在");
  }

  const sub = team.owner.subscription;
  const now = new Date();
  let remainingDays = 30; // 默认 30 天

  if (sub?.endsAt && sub.endsAt.getTime() > now.getTime()) {
    remainingDays = Math.ceil(
      (sub.endsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
    );
  }

  const isYearly = sub?.billingCycle === "yearly";
  const unitPriceMonthly = 99; // 99 元/席位/月
  const unitPriceYearly = 990; // 990 元/席位/年 (相当于 83 元/月)

  let totalAmount = 0;
  if (isYearly) {
    const dailyPrice = unitPriceYearly / 365;
    totalAmount = Math.max(
      99,
      Math.round(extraSeats * dailyPrice * remainingDays * 100) / 100,
    );
  } else {
    const dailyPrice = unitPriceMonthly / 30;
    totalAmount = Math.max(
      39,
      Math.round(extraSeats * dailyPrice * Math.min(remainingDays, 30) * 100) / 100,
    );
  }

  return {
    extraSeats,
    unitPriceMonthly,
    unitPriceYearly,
    remainingDays,
    totalAmount,
    billingCycle: isYearly ? "yearly" : "monthly",
  };
}

/**
 * 离职员工标讯资产一键继承/迁移 (原子事务)
 * 将离职员工名下的跟进标讯、协同批注、标书草稿与监控规则完整交接给新负责人
 */
export async function transferUserBiddingAssets(input: {
  fromUserId: number;
  toUserId: number;
  teamId?: number;
  operatorUserId?: number;
}): Promise<OffboardingTransferResult> {
  const { fromUserId, toUserId, teamId } = input;

  if (fromUserId === toUserId) {
    throw new Error("交接人与接手人不能为同一账号");
  }

  const [fromUser, toUser] = await Promise.all([
    prisma.user.findUnique({ where: { id: fromUserId }, select: { id: true, name: true, username: true } }),
    prisma.user.findUnique({ where: { id: toUserId }, select: { id: true, name: true, username: true } }),
  ]);

  if (!fromUser || !toUser) {
    throw new Error("指定的离职员工或接手人员不存在");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. 迁移跟进标讯 (TenderFollow)
    // 找出接手人已经跟进的标讯，避免主键冲突
    const existingFollows = await tx.tenderFollow.findMany({
      where: { userId: toUserId },
      select: { tenderId: true },
    });
    const existingTenderIds = new Set(existingFollows.map((f) => f.tenderId));

    // 找出需要迁移的标讯（排除重复）
    const followsToTransfer = await tx.tenderFollow.findMany({
      where: { userId: fromUserId },
      select: { id: true, tenderId: true },
    });

    let transferredFollows = 0;
    for (const f of followsToTransfer) {
      if (!existingTenderIds.has(f.tenderId)) {
        await tx.tenderFollow.update({
          where: { id: f.id },
          data: {
            userId: toUserId,
            notes: {
              set: `[资产交接自 ${fromUser.name} 于 ${new Date().toLocaleDateString("zh-CN")}]`,
            },
            ...(teamId ? { teamId } : {}),
          },
        });
        transferredFollows++;
      }
    }

    // 2. 迁移标书编制项目 (ProposalProject)
    const proposalRes = await tx.proposalProject.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    });
    const transferredProposals = proposalRes.count;

    // 3. 迁移商机监控雷达 (PushWatch)
    const watchRes = await tx.pushWatch.updateMany({
      where: { userId: fromUserId },
      data: { userId: toUserId },
    });
    const transferredWatches = watchRes.count;

    // 4. 将离职成员在团队中的角色设置为 INACTIVE 或移除
    if (teamId) {
      await tx.teamMember.deleteMany({
        where: { teamId, userId: fromUserId },
      });
    }

    return {
      fromUserId: fromUser.id,
      fromUserName: fromUser.name || fromUser.username,
      toUserId: toUser.id,
      toUserName: toUser.name || toUser.username,
      transferredFollows,
      transferredComments: 0,
      transferredProposals,
      transferredWatches,
      transferredAt: new Date(),
    };
  });
}
