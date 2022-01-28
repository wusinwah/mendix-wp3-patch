import path from "path"
import sharp from "sharp"
import fs from "fs"
import { sequence } from "./utility";
const fileMap = {
    "app@2x.png":120,
    "app@3x.png":180,
    "appstore@1x.png":1024,
    "ipadapp@1x.png":76,
    "ipadapp@2x.png":152,
    "ipadproapp@2x.png":167,
    "mipmap-hdpi-ic_launcher.png":72,
    "/mipmap-hdpi-ic_launcher_round.png":72,
    "mipmap-mdpi-ic_launcher.png":48,
    "/mipmap-mdpi-ic_launcher_round.png":48,
    "mipmap-xhdpi-ic_launcher.png":96,
    "/mipmap-xhdpi-ic_launcher_round.png":96,
    "mipmap-xxhdpi-ic_launcher.png":144,
    "/mipmap-xxhdpi-ic_launcher_round.png":144,
    "mipmap-xxxhdpi-ic_launcher.png":192,
    "/mipmap-xxxhdpi-ic_launcher_round.png":192,
    "notification@1x.png":20,
    "notification@2x.png":40,
    "notification@3x.png":60,
    "settings@1x.png":29,
    "settings@2x.png":58,
    "settings@3x.png":87,
    "spotlight@1x.png":40,
    "spotlight@2x.png":80,
    "spotlight@3x.png":120,
}
const splahMap:{[key:string]:[number,number]} = {
    "drawable-hdpi-splash":[720,1281],
    "drawable-xhdpi-splash":[960,1708],
    "drawable-xxhdpi-splash":[1440,2562],
    "splash@1x":[640,960],
    "splash@2x":[750,1334],
    "splash@3x":[1242,2208]
}

type ANDROID = {
    "images": {
        filename:string, directory:string,title:string
    }[]
}
type IOS = {
    "images": 
        {
            "size": string,
            "idiom": string,
            "scale": string,
            "type": "splashScreen"|"icon",
            "filename": string
        }[]
}


function exportIcon(iconDir:string, name:string, out:string, map:{[key:string]:[number,number]|number}){
    return new Promise<void>(res=>{
        name = name.toLowerCase().endsWith(".png")?name:`${name}.png`;
        const real = path.join(iconDir,name);
        fs.stat(real,(err, stat)=>{
            if(err)return res();
            console.log("SOURCE",real);
            Promise.all(Object.entries(map).map(ent=>new Promise<void>(res=>{
                if(ent[0].startsWith("/"))return res();
                var dim = Array.isArray(ent[1])?ent[1]:[ent[1],ent[1]]
                sharp(real).resize(dim[0],dim[1]).toFile(path.join(out,ent[0]),(err, info)=>{
                    console.log(`${ent[0]} is created`,err);
                    res();
                })
            }))).finally(()=>{
                res();
            })
        });
    });
}
function setAndroid(mode:"icon"|"splash"){
    return new Promise<void>(res=>{
        fs.readFile(`./assets/${mode==="icon"?"icons":"SplashScreens"}/android.json`,{encoding:"utf-8"},(err, data)=>{
            const JS  : ANDROID = JSON.parse(data);
            Promise.all(JS.images.map(c=>new Promise<void>(res=>{
                fs.copyFile(`./assets/${mode=="icon"?"icons":"SplashScreens"}/${c.title}`,`./android/app/src/main/res/${c.directory}/${c.filename}`,(err)=>{
                    if(err)console.error(err);
                    res();
                })
            }))).finally(()=>{
                res();
            })
        })
    })
}
function setIOS(mode:"icon"|"splash"){
    return new Promise<void>(res=>{
        fs.readFile(`./assets/${mode==="icon"?"icons":"SplashScreens"}/ios.json`,{encoding:"utf-8"},(err, data)=>{
            const JS  : IOS = JSON.parse(data);
            Promise.all(JS.images.map(c=>new Promise<void>(res=>{
                fs.copyFile(`./assets/icons/${c.filename}`,`./ios/nativeTemplate/Images.xcassets/${c.type=="icon"?"AppIcon.appiconset":"SplashScreen.imageset"}/${c.filename}`,()=>{
                    res();
                })
            }))).finally(()=>{
                res();
            })
        })
    })
}


export default function(iconDir:string){
    return new Promise<void>((res,rej)=>{
        fs.readFile(path.join("config.json"),{encoding:"utf-8"},(err, data)=>{
            if(err)return rej("ERROR no config");
            const d=JSON.parse(data);
            if(!d?.bundleName?.main)return rej("invalid configuration");
            let name:string=d.bundleName.main;
            const arr = [
                new Promise<void>(RES=>{
                    fs.stat(path.join(iconDir,"icon"),(err, stat)=>{
                        if(stat && stat.isDirectory()){
                            return exportIcon(path.join(iconDir,"icon"),name,"./assets/icons",fileMap).finally(()=>{
                                RES();
                            })
                        }else{
                            exportIcon(iconDir,name,"./assets/icons",fileMap).finally(RES);
                        }
                    })
                }),
                new Promise<void>(RES=>{
                    fs.stat(path.join(iconDir,"splash"),(err, stat)=>{
                        if(stat && stat.isDirectory()){
                            return exportIcon(path.join(iconDir,"splash"),name,"./assets/splashScreens",splahMap).finally(()=>{
                                RES();
                            })
                        }else{
                            RES();
                        }
                    })
                }),
            ]
            return Promise.all(arr).finally(()=>{
                console.log("==============\n",process.cwd())
                sequence(
                    ()=>setAndroid("icon"),()=>setAndroid("splash"),
                    ()=>setIOS("icon"),()=>setIOS("splash")
                ).finally(()=>{
                    res();
                })
            })
        });
    });
}