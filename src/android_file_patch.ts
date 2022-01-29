import fs from "fs"
import { replaceAll } from "./utility";


export default function updateGradle(ver:string){
    return new Promise<void>(res=>{
        fs.stat("./android/build.gradle.bkup",(err, stat)=>{
            new Promise<void>(res=>{
                err?fs.copyFile("./android/build.gradle","./android/build.gradle.bkup",()=>res()):res();
            }).then(()=>{
                res();
            })
        })
        
    })
}