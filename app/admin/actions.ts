"use server";
import { AuditAction, Prisma, UserRole, UserStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/session";
import { recalculateEloFromTransaction } from "@/lib/elo/recalculation";
import { mergePlayers, mergePlayersInTransaction } from "@/lib/players/merge";
import { assertAdminMayBeDeactivated } from "@/lib/admin/filters";

async function mutateUser(formData:FormData, mutation:(tx:Prisma.TransactionClient,userId:string,adminId:string)=>Promise<void>){const admin=await requireAdmin();const userId=String(formData.get("userId")??"");if(!userId)return;await prisma.$transaction(tx=>mutation(tx,userId,admin.id),{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});revalidatePath("/admin");revalidatePath("/admin/benutzer")}
async function protectLastAdmin(tx:Prisma.TransactionClient,userId:string){const target=await tx.user.findUniqueOrThrow({where:{id:userId},select:{role:true,status:true}});const isActiveAdmin=target.role===UserRole.ADMIN&&target.status===UserStatus.ACTIVE;const count=isActiveAdmin?await tx.user.count({where:{role:UserRole.ADMIN,status:UserStatus.ACTIVE,deletedAt:null}}):0;assertAdminMayBeDeactivated(count,isActiveAdmin)}

export async function addPlayerAlias(fd: FormData) { const admin=await requireAdmin();const playerId=String(fd.get("playerId")??"");const alias=String(fd.get("alias")??"").trim();if(!playerId||!alias)throw new Error("Spieler und Alias sind erforderlich.");await prisma.$transaction(async tx=>{const player=await tx.player.findUniqueOrThrow({where:{id:playerId},select:{alias:true}});const collision=await tx.playerAlias.findFirst({where:{alias:{equals:alias,mode:"insensitive"},validUntil:null,playerId:{not:playerId}},select:{id:true}});if(collision)throw new Error("Dieser Alias gehört bereits zu einem anderen aktiven Spieler.");const now=new Date();const created=await tx.playerAlias.create({data:{playerId,alias,validFrom:now,validUntil:now}});await tx.auditLog.create({data:{actorUserId:admin.id,action:AuditAction.CREATED,entityType:"PlayerAlias",entityId:created.id,oldData:{playerAlias:player.alias},newData:{alias,playerId}}})},{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});revalidatePath(`/admin/spieler/${playerId}`);revalidatePath("/admin/spieler")}
export async function approveUser(fd:FormData){return mutateUser(fd,async(tx,id,admin)=>{const old=await tx.user.findUniqueOrThrow({where:{id},select:{status:true}});const now=new Date();await tx.user.update({where:{id},data:{status:UserStatus.ACTIVE,approvedAt:now,approvedById:admin}});await tx.auditLog.create({data:{actorUserId:admin,action:AuditAction.APPROVED,entityType:"User",entityId:id,oldData:old,newData:{status:UserStatus.ACTIVE,approvedAt:now}}})})}
export async function rejectUser(fd:FormData){return mutateUser(fd,async(tx,id,admin)=>{await protectLastAdmin(tx,id);const old=await tx.user.findUniqueOrThrow({where:{id},select:{status:true}});await tx.user.update({where:{id},data:{status:UserStatus.REJECTED,canCreateGames:false}});await tx.auditLog.create({data:{actorUserId:admin,action:AuditAction.REJECTED,entityType:"User",entityId:id,oldData:old,newData:{status:UserStatus.REJECTED}}})})}
export async function suspendUser(fd:FormData){return mutateUser(fd,async(tx,id,admin)=>{await protectLastAdmin(tx,id);const old=await tx.user.findUniqueOrThrow({where:{id},select:{status:true}});await tx.user.update({where:{id},data:{status:UserStatus.SUSPENDED}});await tx.auditLog.create({data:{actorUserId:admin,action:AuditAction.SUSPENDED,entityType:"User",entityId:id,oldData:old,newData:{status:UserStatus.SUSPENDED}}})})}
export async function reactivateUser(fd:FormData){return mutateUser(fd,async(tx,id,admin)=>{const old=await tx.user.findUniqueOrThrow({where:{id},select:{status:true}});await tx.user.update({where:{id},data:{status:UserStatus.ACTIVE}});await tx.auditLog.create({data:{actorUserId:admin,action:AuditAction.REACTIVATED,entityType:"User",entityId:id,oldData:old,newData:{status:UserStatus.ACTIVE}}})})}
export async function updatePermissions(fd:FormData){return mutateUser(fd,async(tx,id,admin)=>{const old=await tx.user.findUniqueOrThrow({where:{id},select:{requiresGameApproval:true,canCreateGames:true,gameEntryBlockedUntil:true,profileRestricted:true}});const until=String(fd.get("blockedUntil")??"");const next={requiresGameApproval:fd.get("requiresApproval")==="on",canCreateGames:fd.get("canCreateGames")==="on",gameEntryBlockedUntil:until?new Date(until):null,profileRestricted:fd.get("profileRestricted")==="on"};await tx.user.update({where:{id},data:next});await tx.auditLog.create({data:{actorUserId:admin,action:AuditAction.UPDATED,entityType:"UserPermissions",entityId:id,oldData:old,newData:next,note:old.profileRestricted!==next.profileRestricted?"Profileinschränkung geändert":undefined}})})}
export async function changeRole(fd:FormData){return mutateUser(fd,async(tx,id,admin)=>{const role=String(fd.get("role")) as UserRole;if(!Object.values(UserRole).includes(role))return;if(role!==UserRole.ADMIN)await protectLastAdmin(tx,id);const old=await tx.user.findUniqueOrThrow({where:{id},select:{role:true}});await tx.user.update({where:{id},data:{role}});await tx.auditLog.create({data:{actorUserId:admin,action:AuditAction.UPDATED,entityType:"UserRole",entityId:id,oldData:old,newData:{role}}})})}
export async function rejectClaim(fd:FormData){const admin=await requireAdmin();const id=String(fd.get("claimId")??"");const note=String(fd.get("note")??"").trim();await prisma.$transaction(async tx=>{const old=await tx.playerClaim.findUniqueOrThrow({where:{id},select:{status:true}});await tx.playerClaim.update({where:{id},data:{status:"REJECTED",reviewedByUserId:admin.id,reviewedAt:new Date(),note}});await tx.auditLog.create({data:{actorUserId:admin.id,action:AuditAction.REJECTED,entityType:"PlayerClaim",entityId:id,oldData:old,newData:{status:"REJECTED"},note}})});revalidatePath("/admin/claims")}

export async function mergePlayersAction(fd: FormData) {
  const admin = await requireAdmin();
  const sourcePlayerId = String(fd.get("sourcePlayerId") ?? "");
  const targetPlayerId = String(fd.get("targetPlayerId") ?? "");
  const note = String(fd.get("note") ?? "").trim();
  await mergePlayers({ sourcePlayerId, targetPlayerId, actorUserId: admin.id, note });
  revalidatePath("/"); revalidatePath("/partien"); revalidatePath("/admin"); revalidatePath("/admin/spieler"); revalidatePath("/admin/claims");
}

export async function approveClaim(fd: FormData) {
  const admin = await requireAdmin(); const claimId = String(fd.get("claimId") ?? ""); const note = String(fd.get("note") ?? "").trim();
  await prisma.$transaction(async (tx) => {
    const claim = await tx.playerClaim.findUniqueOrThrow({ where: { id: claimId }, select: { id: true, status: true, playerId: true, submittedByUserId: true, submittedByUser: { select: { player: { select: { id: true } } } }, player: { select: { userId: true } } } });
    if (claim.status !== "PENDING") throw new Error("Nur offene Claims können genehmigt werden.");
    if (claim.player.userId && claim.player.userId !== claim.submittedByUserId) throw new Error("Dieser Spieler ist bereits einem anderen Benutzerkonto zugeordnet.");
    const currentPlayerId = claim.submittedByUser.player?.id;
    if (currentPlayerId && currentPlayerId !== claim.playerId) {
      await mergePlayersInTransaction(tx, { sourcePlayerId: currentPlayerId, targetPlayerId: claim.playerId, actorUserId: admin.id, note: note || "Spieler-Claim genehmigt" });
    } else if (!currentPlayerId) {
      await tx.player.update({ where: { id: claim.playerId }, data: { userId: claim.submittedByUserId } });
    }
    const now = new Date();
    await tx.playerClaim.update({ where: { id: claim.id }, data: { status: "APPROVED", reviewedByUserId: admin.id, reviewedAt: now, note } });
    await tx.playerClaim.updateMany({ where: { playerId: claim.playerId, id: { not: claim.id }, status: "PENDING" }, data: { status: "REJECTED", reviewedByUserId: admin.id, reviewedAt: now, note: "Spieler wurde einem anderen Claim zugeordnet." } });
    await tx.auditLog.create({ data: { actorUserId: admin.id, action: AuditAction.APPROVED, entityType: "PlayerClaim", entityId: claim.id, oldData: { status: claim.status }, newData: { status: "APPROVED", playerId: claim.playerId, userId: claim.submittedByUserId }, note } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  revalidatePath("/"); revalidatePath("/admin"); revalidatePath("/admin/claims"); revalidatePath("/mein-profil");
}
export async function rejectGame(fd:FormData){const admin=await requireAdmin();const id=String(fd.get("gameId")??"");const note=String(fd.get("note")??"").trim();await prisma.$transaction(async tx=>{const old=await tx.game.findUniqueOrThrow({where:{id},select:{status:true}});await tx.game.update({where:{id},data:{status:"REJECTED"}});await tx.auditLog.create({data:{actorUserId:admin.id,action:AuditAction.REJECTED,entityType:"Game",entityId:id,oldData:old,newData:{status:"REJECTED"},note}})});revalidatePath("/admin/partien")}

export async function confirmGame(fd: FormData) {
  const admin = await requireAdmin();
  const id = String(fd.get("gameId") ?? "");
  const note = String(fd.get("note") ?? "").trim();
  if (!id) throw new Error("Die Partie-ID fehlt.");

  await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUniqueOrThrow({
      where: { id },
      select: { id: true, status: true, playedAt: true, participants: { select: { id: true } } },
    });
    if (game.status !== "PENDING") throw new Error("Nur ausstehende Partien können bestätigt werden.");
    if (game.participants.length !== 4 && game.participants.length !== 5) {
      throw new Error("Die Partie muss genau 4 oder 5 Teilnehmer enthalten.");
    }

    const confirmedAt = new Date();
    await tx.game.update({ where: { id }, data: { status: "CONFIRMED", confirmedAt } });
    await tx.gameReviewFlag.updateMany({ where: { gameId: id, resolvedAt: null }, data: { resolvedAt: confirmedAt } });
    await recalculateEloFromTransaction(tx, game.playedAt);
    await tx.auditLog.create({
      data: {
        actorUserId: admin.id,
        action: AuditAction.APPROVED,
        entityType: "Game",
        entityId: id,
        oldData: { status: game.status },
        newData: { status: "CONFIRMED", confirmedAt },
        note: note || "Pending-Partie nach chronologischer Elo-Neuberechnung bestätigt",
      },
    });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  revalidatePath("/");
  revalidatePath("/partien");
  revalidatePath(`/partien/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/partien");
}
