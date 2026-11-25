import { parentPort, workerData } from "worker_threads";
import { contarPrimos } from "./calculo";

const {n} = workerData as { n: number };
parentPort?.postMessage( contarPrimos(n) );

