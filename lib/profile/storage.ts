import { storeImage } from "@/lib/storage/images";
export function storeProfileImage(file:File){return storeImage(file,"profiles")}
