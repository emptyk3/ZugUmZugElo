import { validateProductionConfig } from "../lib/config.ts";
try{validateProductionConfig(process.env);console.log("Production-Konfiguration ist gültig.")}catch(error){console.error(error instanceof Error?error.message:"Production-Konfiguration ist ungültig.");process.exit(1)}
