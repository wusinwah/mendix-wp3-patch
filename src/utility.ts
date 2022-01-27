import { spawn } from "child_process";
import os from "os"
const isWin = os.platform()==="win32";

export function WinCommand(s:string){
    return isWin?`${s}.cmd`:s;
}

export function command(cmd:string,dir:string, ...args:string[]){
    console.log(cmd,args)
    const p = spawn(cmd,args,{cwd:dir});
    return new Promise<void>((res,rejects)=>{
        p.stderr.on("data", b=>{
            process.stderr.write(b?b.toString().trim():"---");
        })
        p.on("error",()=>{
            rejects()
        })
        p.on("exit",(code)=>{
            if(code!=0)return rejects();
            res();
        })
    });
}

export function sequence(...pro:(()=>Promise<void>)[]):Promise<void>{
    return pro.reduce((p,c)=>new Promise(Res=>{
        p.then(()=>{
            c().then(()=>{
                Res();
            })
        })
    }),Promise.resolve());
}
export function chdir(cmd:string){
    process.chdir(cmd);
    return Promise.resolve();
}

function escapeRegExp(string:string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
  }
  
export function replaceAll(str:string, find:string, replace:string) {
    return str.replace(new RegExp(escapeRegExp(find), 'g'), replace);
  }
