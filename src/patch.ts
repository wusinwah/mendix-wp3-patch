import fs from "fs"
import path from "path"
import process from "process";

import {chdir, command, sequence,WinCommand} from "./utility"
import updateGradle from "./android_file_patch"
import patch from "./ios_file_patch";

//const clone = "https://wusinwah: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@github.com/wusinwah/wp3.a.git"

const PROPERTY_KEYS = ["cwd","message","git"] as const
type PROPERTY_KEY = typeof PROPERTY_KEYS[number];
type PROPERTY_SET = {[key in PROPERTY_KEY]?:number|string|string[]}

interface CONFIG extends PROPERTY_SET  {
    git:string,message?:string,cwd:string, modules?:string[]
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

    let cmd:(()=>Promise<void>)[] = [
        ()=>new Promise<void>(res=>fs.rmdir(root,{recursive:true},()=>res() )),
        ()=>new Promise<void>(res=>fs.mkdir(root,{recursive:true},()=>res() )),
        ()=>command("git",".","clone",clone,root),
        ()=>chdir(path.join(root)),
        ...Object.entries(modules).map(mod=>{
            return ()=>command(WinCommand("npm"),".","install","--save",mod[1]===null?mod[0]: `${mod[0]}@${mod[1]}`)
        }),
        ()=>command("npm",".","install","."),
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
        ()=>patch(config.message)
    ]
    let remain = [
        ()=>chdir(path.join(root)),
        ()=>updateGradle(),
        ()=>chdir(current)
    ]

    return new Promise<string>(Res=>{
        sequence(...cmd,...ios,...remain).then(()=>{
            Res(root);
        })
    });
}
const props = process.argv.reduce((p:string,c)=>{
    if(c.startsWith("-i="))p=path.resolve(c.substring(3));
    return p;
},path.join(__dirname,"config.properties"))

fs.readFile(props,{ encoding:"utf-8"}, (Err, data)=>{
    if(Err)return console.error("unable to read configuration file");
    const line = data.split("\n").map(e=>e.trim()).filter(c=>c.length);
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
    },{git:"", cwd:".", message:undefined})
    if(cmd.git.length===0)return console.error("git configuration is not defined in ",props);
    const START = new Date().getTime();
    start(cmd).then(o=>{
        console.clear();
        console.log("Project folder created in ")
        console.log(o);
        console.log("Android project folder\n\t",path.join(o,"android"));
        if(process.platform==="darwin"){
            console.log("iOS project folder\n\t",path.join(o,"ios"));
        }
        console.log(`elapsed time ...  ${((new Date().getTime()-START)/1000).toFixed(1)}s`);
    })
})
