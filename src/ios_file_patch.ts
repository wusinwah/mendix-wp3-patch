import fs from "fs";
import path from "path";
import {sequence} from "./utility"
import {parse, build} from "plist"

export default function (bg_loc?:string, bg_task?:string):Promise<void>{
    const current = process.cwd();
    const cmd = [
        ()=>mauron85_patch(current),
        ()=>info_plist(current,bg_loc||"Requesting to track location at the background", bg_task||"Requesting to allow background processing")
    ]

    return new Promise<void>(res=>{
        sequence(...cmd).then(()=>{
            process.chdir(current);
            res();
        })
    })
}

function mauron85_patch(current:string){
    return new Promise<void>(res=>{
        const fileName=path.join(current,"node_modules","@mauron85","react-native-background-geolocation","ios","common","BackgroundGeolocation","MAURPostLocationTask.m");
        fs.readFile(fileName,{encoding:"utf-8"},(err, data)=>{
            const D=data.split('\n');
            var out = D.map(d=>{
                if(d.indexOf('@"application/json')>=0){
                    return `//${d}`;
                }
                return d;
            })
            fs.writeFile(fileName,out.join("\n"),()=>{
                res();
            });
        })
    });
}
function info_plist(current:string, bg_loc:string, bg_task:string){
    return new Promise<void>(res=>{
        const xml = path.join(current,"ios","nativeTemplate","Info.plist");
        fs.readFile(xml,{encoding:"utf-8"},(err, data)=>{
            let json = parse(data) as {[key:string]:any}
            json["BGTaskSchedulerPermittedIdentifiers"] = json["BGTaskSchedulerPermittedIdentifiers"]||bg_task
            json["NSUserTrackingUsageDescription"]=json["NSUserTrackingUsageDescription"]||bg_loc;
            fs.writeFile(xml,build(json),()=>{
                res();
            });
        })
    });
}