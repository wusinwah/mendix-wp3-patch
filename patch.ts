import fs from "fs"
import path from "path"
import {spawn} from "child_process"
import process from "process";


//const clone = "https://wusinwah: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@github.com/wusinwah/wp3.a.git"

function command(cmd:string,dir:string, ...args:string[]){
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

function sequence(...pro:(()=>Promise<void>)[]):Promise<void>{
    return pro.reduce((p,c)=>new Promise(Res=>{
        p.then(()=>{
            c().then(()=>{
                Res();
            })
        })
    }),Promise.resolve());
}
function chdir(cmd:string){
    process.chdir(cmd);
    return Promise.resolve();
}
function updateGradle(){
    return new Promise<void>(res=>{
        fs.stat("./android/build.gradle.bkup",(err, stat)=>{
            new Promise<void>(res=>{
                err?fs.copyFile("./android/build.gradle","./android/build.gradle.bkup",()=>res()):res();
            }).then(()=>{
                fs.readFile("./android/build.gradle",{ encoding:"utf-8"},(err, data)=>{
                    if(err){
                        console.error(err);
                        res();
                    }
                    const m = data.split("\n");
                    let flag = "";
                    let ext : string[] = [], dep:string[] = [];
                    let out = m.reduce((p:string[],c)=>{
                        var tc = c.trim();
                        if(tc.startsWith("ext") && tc.endsWith("{")){
                            p.push(c);
                            flag = "ext";
                            return p;
                        }
                        if(tc.startsWith("dependencies") && tc.endsWith("{")){
                            p.push(c);
                            flag = "dependencies";
                            return p;
                        }
                        if(tc=="}"){
                            if(flag==="ext"){
                                const dict = ext.reduce((p:{[key:string]:string},c)=>{
                                    var x = c.split("=");
                                    p[x[0].trim()]=x[1].trim();
                                    return p;
                                },{})
                                const ind = ext.findIndex((o)=>{
                                    return o.trim().startsWith("playServicesVersion")
                                })
                                if(ind>=0){
                                    ext.splice(ind,1);
                                    ext.push('playServicesVersion = "16.0.0"');
                                }
                            
                                if(!dict["googlePlayServicesVersion"]){
                                    ext.push('googlePlayServicesVersion = "16.0.0"');
                                }
                                if(!dict["googlePlayServicesVisionVersion"]){
                                    ext.push('googlePlayServicesVisionVersion = "19.0.0"');
                                }
                                p=p.concat(ext.map(e=>"        "+e.trim()));
                            }
                            let cls:string[] = [], other:string[] = [];
                            if(flag=="dependencies"){
                                let ok = false;
                                dep.forEach(x=>{
                                    x=x.trim();
                                    if(x.startsWith("classpath")){
                                        var t = x.substring(9,999).trim()
                                        t=t.substring(1,t.length-1);
                                        if(t.startsWith("com.google.gms:google-services:")||t=="com.google.gms:google-services")ok=true;
                                        cls.push(t);
                                    }else{
                                        other.push(x);
                                    }
                                });
                                if(!ok)cls.push("com.google.gms:google-services:4.2.0");
                                p=p.concat(cls.map(x=>`        classpath "${x}"`));
                                p=p.concat(other.map(x=>'        '+x));
                            }
                            flag="";
                        }
                        if(flag=="ext"){
                            ext.push(c);
                            return p;
                        }
                        if(flag=="dependencies"){
                            dep.push(c);
                            return p;
                        }
                        p.push(c);

                        return p;
                    },[])
                    fs.writeFile("./android/build.gradle",out.join("\n"),()=>{
                        res();
                    });
                })
            })
        })
        
    })
}
function start(_root:string, clone:string){
    const current = process.cwd();
    const d = new Date();
    const root=path.join(_root,`source-${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`);

    let cmd:(()=>Promise<void>)[] = [
        ()=>new Promise<void>(res=>fs.rmdir(root,{recursive:true},()=>res())),
        ()=>new Promise<void>(res=>fs.mkdir(root,{recursive:true},()=>res() )),
        ()=>command("git",".","clone",clone,root),
        ()=>chdir(path.join(root)),
        ()=>command("npm",".","install","--save","@mauron85/react-native-background-geolocation@0.6.3"),

        ()=>command("npm",".","install","--save","react-native-tracking-transparency@0.1.1"),

        ()=>command("npm",".","install","."),
        ()=>chdir(path.join(root,"ios")),
        ()=>new Promise<void>(res=>fs.rename("nativeTemplate","native-template",()=>{res()})),
        ()=>chdir(path.join(root)),
        ()=>command("react-native",".","link","@mauron85/react-native-background-geolocation"),
        ()=>command("react-native",".","link","react-native-tracking-transparency"),
    ];
    let ios = process.platform!="darwin"?[]: [
        ()=>chdir(path.join(root,"ios")),
        ()=>new Promise<void>(res=>fs.rename("native-template","nativeTemplate",()=>{res()})),
        ()=>command("pod",".","install"),
        ()=>chdir(path.join(root,"node_modules","@mauron85","react-native-background-geolocation","ios","common","BackgroundGeolocation")),
        ()=>new Promise<void>(res=>{
            fs.readFile("MAURPostLocationTask.m",{encoding:"utf-8"},(err, data)=>{
                const D=data.split('\n');
                var out = D.map(d=>{
                    if(d.indexOf('@"application/json')>=0){
                        return `//${d}`;
                    }
                    return d;
                })
                fs.writeFile("MAURPostLocationTask.m",out.join("\n"),()=>{
                    res();
                });
            })
        })
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
    const cmd  = line.reduce((p:{git?:string, cwd:string},c)=>{
        const index = c.indexOf("=");
        if(index<0 && !c.startsWith("#")){
            console.warn(`${c} is not a valid configuration`)
        }else{
            const tag = c.substring(0,index).trim();
            const file = c.substring(index+1).trim();
            if(tag==="git" || tag==="cwd"){
                p[tag] = file;
                return p;
            }
            console.warn(`unknown tag <${tag}>`)
        }
        return p;
    },{git:undefined, cwd:process.cwd()})
    if(cmd.git===undefined)return console.error("git configuration is not defined in ",props);
    const START = new Date().getTime();
    start(cmd.cwd, cmd.git).then(o=>{
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
