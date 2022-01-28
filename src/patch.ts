import fs, { fstat } from "fs"
import path from "path"
import process from "process";
import os from "os"
import {chdir, command, sequence,WinCommand} from "./utility"
import updateGradle from "./android_file_patch"
import patch from "./ios_file_patch";
import imagePatch from "./image_patch"
import { spawn } from "child_process";
//const clone = "https://wusinwah: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@github.com/wusinwah/wp3.a.git"

const PROPERTY_KEYS = ["cwd","bg_loc","bg_task","git","image"] as const
type PROPERTY_KEY = typeof PROPERTY_KEYS[number];
type PROPERTY_SET = {[key in PROPERTY_KEY]?:number|string|string[]}

interface CONFIG extends PROPERTY_SET  {
    git:string,bg_loc?:string,bg_task?:string,cwd:string, modules?:string[],image?:string
}

const modules = {
    "@mauron85/react-native-background-geolocation":"0.6.3",
    "react-native-tracking-transparency":"0.1.1"
}



function start(config:CONFIG){
    let m = modules;
    (config.modules||[]).reduce((p:{[key:string]:string|null},c)=>{
        const t = c.lastIndexOf("@");
        if(t<=0){
            p[c]=null;
            return p;
        }
        p[c.substring(0,t).trim()]=c.substring(t+1);
        return p;
    },modules);
    let _root:string = config.cwd, clone:string = config.git;
    const current = process.cwd();
    const d = new Date();
    const root=path.resolve(path.join(_root,`source-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`));

    let version = "0.0.0";
    return new Promise<string>(Res=>{
        
        let cmd:(()=>Promise<void>)[] = [
            ()=>new Promise<void>(res=>fs.rmdir(root,{recursive:true},()=>res() )),
            ()=>new Promise<void>(res=>fs.mkdir(root,{recursive:true},()=>res() )),
            ()=>command("git",".","clone",clone,root),
            ()=>chdir(path.join(root)),
            ()=>new Promise<void>(res=>{
                fs.readFile(path.join(root, "config.json"),{encoding:"utf-8"},(err, data2)=>{
                    if(err){
                        console.error("no config",err);process.exit(1);
                    }
                    const cfg : {
                        "appVersion": string,
                        "buildNumber": number,
                    }=JSON.parse(data2);
        
                    version = `${cfg.appVersion}(${cfg.buildNumber})`;
                    res();
                });
            }),
            ()=>chdir(current),
            config.image?()=>imagePatch(config.image||"", root ):()=>Promise.resolve(),
            ()=>chdir(root),
            ...Object.entries(modules).map(mod=>{
                return ()=>command(WinCommand("npm"),".","install","--save",mod[1]===null?mod[0]: `${mod[0]}@${mod[1]}`)
            }),
            ()=>command(WinCommand("npm"),".","install","."),
            ()=>chdir(path.join(root,"ios")),
            ()=>new Promise<void>(res=>fs.rename("nativeTemplate","native-template",()=>{res()})),
            ()=>chdir(path.join(root)),
            ...Object.entries(modules).map(mod=>{
                return ()=>command(WinCommand("react-native"),".","link",mod[0])
            })
        ];
        let ios = process.platform!="darwin"?[]: [
            ()=>chdir(path.join(root,"ios")),
            ()=>new Promise<void>(res=>fs.rename("native-template","nativeTemplate",()=>{res()})),
            ()=>command("pod",path.join(root,"ios"),"install"),
            ()=>chdir(path.join(root)),
            ()=>patch(version,config.bg_loc, config.bg_task)
        ]
        let remain = [
            ()=>chdir(path.join(root)),
            ()=>updateGradle(version),
            ()=>chdir(current),
        ]
        sequence(...cmd,...ios,...remain).then(()=>{
            Res(root);
        })
    });
}


let mode : [string|undefined,string|undefined,string|undefined]=[undefined,undefined,undefined];

["-c","-a","-i"].forEach((key,index)=>{
    const ind = process.argv.indexOf(key);
    if(ind>=0){
        mode[index]=process.argv[ind+1];
    }
})
const arr : (()=>Promise<void>)[] = [];
if(mode[0]){
    const props = mode[0];
    arr.push(()=>new Promise<void>(res=>{
        fs.readFile(props,{ encoding:"utf-8"}, (Err, data)=>{
            if(Err){ console.log("no config file");return;}
            
            
            if(Err)return console.error("unable to read configuration file");
            const line = data.split("\n").map(e=>e.trim()).filter(c=>c.length && !c.startsWith("#"));
            const cmd  = line.reduce((p:CONFIG,c)=>{
                
                const index = c.indexOf("=");
                if(index<0 && !c.startsWith("#")){
                    console.warn(`${c} is not a valid configuration`)
                }else{
                    const tag = c.substring(0,index).trim();
                    const file = c.substring(index+1).trim();
                    if(PROPERTY_KEYS.indexOf(tag as any)>=0){
                        p[tag as typeof PROPERTY_KEYS[number]] = file;
                        return p;
                    }
                    console.warn(`unknown tag <${tag}>`)
                }
                return p;
            },{git:"", cwd:".", bg_task:undefined})
            if(cmd.git.length===0)return console.error("git configuration is not defined in ",props);
            const START = new Date().getTime();
            console.log('processing',cmd.cwd)
            
            start(cmd).then(o=>{
                console.clear();
                console.log("Project folder created in ")
                console.log(o);
                console.log("Android project folder\n\t",path.join(o,"android"));
                
                if(process.platform==="darwin"){
                    console.log("iOS project folder\n\t",path.join(o,"ios"));
                }
                console.log(`elapsed time ...  ${((new Date().getTime()-START)/1000).toFixed(1)}s`);
                res();
            });
        });
    }));
}
if(mode[1]){
    const props = mode[1];
    arr.push(()=>new Promise<void>(res=>{
        
        switch(os.platform()){
            case "darwin":
                return spawn("open",["-a","/Applications/Android Studio.app", path.join(props,"android")],{cwd:"."}).on("exit",()=>{
                    res();
                });
            case "win32":
                return spawn("c:\\Program Files\\Android\\Android Studio\\bin\\studio64.exe", [path.join(props,"android")],{cwd:"."}).on("exit",()=>{
                    res();
                });
            default:console.error("OS not supported");
            res();
        }
        
    }));
}
if(mode[2]){
    const props = mode[2];
    arr.push(()=>new Promise<void>(res=>{
        spawn("open",["NativeTemplate.xcworkspace"],{cwd:path.join(props,"ios")}).on("exit",()=>{
            res();
        })
    }));
}
sequence(...arr).then(()=>{
    console.log("Completed on ",new Date())
})
