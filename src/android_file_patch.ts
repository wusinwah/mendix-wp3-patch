import fs from "fs"

export default function updateGradle(){
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