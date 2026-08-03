import assert from "node:assert/strict";
import test from "node:test";
import { UserRole, UserStatus } from "@prisma/client";
import { hashPassword, validatePassword, verifyPassword } from "./password.ts";
import { gameSubmissionPolicy, isAdmin, mayLogin, type AuthorizationUser } from "./policy.ts";

function user(overrides: Partial<AuthorizationUser> = {}): AuthorizationUser {
  return { id:"u1",role:UserRole.USER,status:UserStatus.ACTIVE,deletedAt:null,emailVerifiedAt:new Date(),canCreateGames:true,requiresGameApproval:false,gameEntryBlockedUntil:null,profileRestricted:false,...overrides };
}

test("Passwörter werden gehasht und korrekt/falsch geprüft", async()=>{const hash=await hashPassword("SicheresPasswort123");assert.notEqual(hash,"SicheresPasswort123");assert.equal(await verifyPassword("SicheresPasswort123",hash),true);assert.equal(await verifyPassword("Falsch123Password",hash),false)});
test("Passwörter benötigen nur mindestens vier Zeichen",()=>{assert.equal(validatePassword("abc"),"Das Passwort muss mindestens 4 Zeichen lang sein.");assert.equal(validatePassword("abcd"),null);assert.equal(validatePassword("!!!!"),null)});
test("gesperrte Benutzer dürfen sich nicht anmelden",()=>assert.equal(mayLogin(user({status:UserStatus.SUSPENDED})),false));
test("unbestätigte E-Mail blockiert Partie",()=>assert.equal(gameSubmissionPolicy(user({status:UserStatus.EMAIL_UNVERIFIED,emailVerifiedAt:null})).allowed,false));
test("Pending-Nutzer erzeugt Review-Grund",()=>assert.deepEqual(gameSubmissionPolicy(user({status:UserStatus.PENDING_APPROVAL})).reasons,["CREATOR_NOT_APPROVED"]));
test("aktiver Nutzer darf ohne Review-Grund eintragen",()=>assert.deepEqual(gameSubmissionPolicy(user()).reasons,[]));
test("Freigabepflicht erzeugt Review-Grund",()=>assert.deepEqual(gameSubmissionPolicy(user({requiresGameApproval:true})).reasons,["USER_REQUIRES_APPROVAL"]));
test("eingeschränktes Profil erzeugt Pending-Partie",()=>assert.deepEqual(gameSubmissionPolicy(user({profileRestricted:true})).reasons,["USER_REQUIRES_APPROVAL"]));
test("entzogenes Eintragungsrecht blockiert",()=>assert.equal(gameSubmissionPolicy(user({canCreateGames:false})).allowed,false));
test("nur aktive Administratoren erfüllen Adminprüfung",()=>{assert.equal(isAdmin(user({role:UserRole.ADMIN})),true);assert.equal(isAdmin(user()),false)});
