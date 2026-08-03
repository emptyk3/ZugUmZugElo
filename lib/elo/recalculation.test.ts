import assert from "node:assert/strict";
import test from "node:test";
import { calculateChronologicalRatings, type ChronologicalGame } from "./timeline.ts";

const ratings = new Map([["a",1500],["b",1500],["c",1500],["d",1500]]);
function game(id:string,day:number,order=["a","b","c","d"]):ChronologicalGame{return{id,playedAt:new Date(`2026-01-${String(day).padStart(2,"0")}T12:00:00Z`),createdAt:new Date(`2026-02-${String(day).padStart(2,"0")}T12:00:00Z`),participants:order.map((playerId,index)=>({id:`${id}-${playerId}`,playerId,points:100-index*10,tiebreakRank:null}))}}
function update(result:ReturnType<typeof calculateChronologicalRatings>,gameId:string,playerId:string){return result.participantUpdates.find(item=>item.gameId===gameId&&item.playerId===playerId)!}

test("eine alte bestätigte Pending-Partie verändert die Elo-Ausgangswerte späterer Partien",()=>{const later=game("later",2,["d","c","b","a"]);const withoutPending=calculateChronologicalRatings(ratings,[later]);const withPending=calculateChronologicalRatings(ratings,[game("pending",1),later]);assert.equal(update(withoutPending,"later","a").ratingBefore,1500);assert.notEqual(update(withPending,"later","a").ratingBefore,1500);assert.notEqual(update(withPending,"later","a").ratingChange,update(withoutPending,"later","a").ratingChange)});

test("eine neue bestätigte Pending-Partie verändert keine frühere Elo",()=>{const earlier=game("earlier",1);const before=calculateChronologicalRatings(ratings,[earlier]);const after=calculateChronologicalRatings(ratings,[earlier,game("pending-new",3,["d","c","b","a"])]);assert.deepEqual(after.participantUpdates.filter(item=>item.gameId==="earlier"),before.participantUpdates)});

test("Rückdatierung löst unabhängig von der Eingabereihenfolge die korrekte chronologische Neuberechnung aus",()=>{const backdated=game("backdated",1);const later=game("later",2,["d","c","b","a"]);const sorted=calculateChronologicalRatings(ratings,[backdated,later]);const unsorted=calculateChronologicalRatings(ratings,[later,backdated]);assert.deepEqual(unsorted,sorted);assert.equal(update(unsorted,"later","a").ratingBefore,update(unsorted,"backdated","a").ratingAfter)});

test("eine abgelehnte Partie wird nicht in den bestätigten Zeitstrahl aufgenommen und verändert keine Elo",()=>{const confirmed=game("confirmed",2);const rejected=game("rejected",1,["d","c","b","a"]);const expected=calculateChronologicalRatings(ratings,[confirmed]);const actual=calculateChronologicalRatings(ratings,[confirmed]);assert.deepEqual(actual,expected);assert.equal(actual.participantUpdates.some(item=>item.gameId===rejected.id),false)});
