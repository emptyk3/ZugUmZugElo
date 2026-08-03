import assert from "node:assert/strict";import test from "node:test";import { assertAdminMayBeDeactivated,formatAuditDetails,gameMatchesStatus,playerMatchesSearch } from "./filters.ts";
test("Admin ohne aktive Adminrolle erhält nach zentraler Rollenregel keinen Zugriff",()=>{const mayAccess=(role:string,status:string)=>role==="ADMIN"&&status==="ACTIVE";assert.equal(mayAccess("USER","ACTIVE"),false);assert.equal(mayAccess("ADMIN","SUSPENDED"),false)});
test("letzter aktiver Admin kann nicht entfernt werden",()=>assert.throws(()=>assertAdminMayBeDeactivated(1,true),/letzte aktive Administrator/));
test("Benutzer sperren bleibt erlaubt, wenn ein weiterer Admin aktiv ist",()=>assert.doesNotThrow(()=>assertAdminMayBeDeactivated(2,true)));
test("Spielersuche berücksichtigt aktuellen und historische Aliasse",()=>{const player={alias:"Nordbahn",aliases:["Alte Lok"]};assert.equal(playerMatchesSearch(player,"lok"),true);assert.equal(playerMatchesSearch(player,"süd"),false)});
test("Partienfilter unterscheidet Status",()=>{assert.equal(gameMatchesStatus({status:"PENDING"},"PENDING"),true);assert.equal(gameMatchesStatus({status:"CONFIRMED"},"PENDING"),false);assert.equal(gameMatchesStatus({status:"REJECTED"},"ALL"),true)});
test("Audit-Log-Details werden anzeigbar formatiert",()=>assert.equal(formatAuditDetails({status:"ACTIVE"}),'{"status":"ACTIVE"}'));
