"use client";
import { useEffect, useState } from "react";import styles from "./PlayerAvatar.module.css";
type Props={imageUrl?:string|null;alias:string;size?:number;className?:string};
export function PlayerAvatar({imageUrl,alias,size=44,className}:Props){const[failed,setFailed]=useState(false);useEffect(()=>setFailed(false),[imageUrl]);const initial=alias.trim().slice(0,1).toLocaleUpperCase("de")||"?";return <span className={[styles.avatar,className].filter(Boolean).join(" ")} style={{width:size,height:size,fontSize:Math.max(12,Math.round(size*.38))}} aria-label={imageUrl&&!failed?`Profilbild von ${alias}`:`Avatar von ${alias}`}>{imageUrl&&!failed?<img src={imageUrl} alt="" width={size} height={size} loading="lazy" decoding="async" onError={()=>setFailed(true)}/>:<span aria-hidden="true">{initial}</span>}</span>}
export default PlayerAvatar;
