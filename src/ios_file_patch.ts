import fs from "fs"
import path from "path";
import {replaceAll, sequence} from "./utility"
import {parse, build} from "plist"
import fetch from "node-fetch"

export default function ( bg_loc?:string, bg_task?:string):Promise<void>{
    const current = process.cwd();
    const cmd = [
        ()=>mauron85_patch(current),
        ()=>info_plist(current,bg_loc||"Requesting to track location at the background", bg_task||"Requesting to allow background processing"),
        
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
        const fileName=path.join(current,"node_modules","@mauron85","react-native-background-geolocation", "ios","common","BackgroundGeolocation","MAURPostLocationTask.m");

		
		//
		fetch("https://raw.githubusercontent.com/wusinwah/mendix-background-geolocation/main/ios/common/BackgroundGeolocation/MAURPostLocationTask.m").then(o=>{
            o.text().then(s=>{
                fs.writeFile(fileName,s,()=>{
                    res();
                });
            });    
        });
        
    });
}
function info_plist(current:string, bg_loc:string, bg_task:string){
    return new Promise<void>(res=>{
        const xml = path.join(current,"ios","nativeTemplate","Info.plist");
        fs.readFile(xml,{encoding:"utf-8"},(err, data)=>{
            if(err)return res();
            let json = parse(data) as {[key:string]:any}
            /*<string>fetch</string>
            <string>location</string>
            <string>processing</string>*/
            //json["UIBackgroundModes"]
            var arr = json["UIBackgroundModes"]||[];
            
            json["UIBackgroundModes"] = ["fetch","location","processing","remote-notification"].reduce((p:string[],c:string)=>{
                if(p.indexOf(c)<0)p.push(c);
                return p;
            },json["UIBackgroundModes"]||[] as string[])
            json["BGTaskSchedulerPermittedIdentifiers"] = json["BGTaskSchedulerPermittedIdentifiers"]||bg_task
            json["NSUserTrackingUsageDescription"]=json["NSUserTrackingUsageDescription"]||bg_loc;
            fs.writeFile(xml,build(json),()=>{
                res();
            });
        })
    });
}
