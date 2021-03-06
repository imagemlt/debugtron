import { v4 } from 'uuid'
import { spawn } from 'child_process'
import { updateContents, updatePages } from '../reducers/session'
import { PageInfo, Dict, AppInfo } from '../types'
import fetch from 'node-fetch'
import { addSession, updateLog, removeSession  } from '../reducers/session'
import { State } from '../reducers'
import { dialog } from 'electron'
import getPort from 'get-port'
import { ThunkAction } from 'redux-thunk'
import { Adapter } from './adapter'
import { getApps, getAppStart } from '../reducers/app'
import CDP from 'chrome-remote-interface';
import { ipcMain } from 'electron'


export const fetchPages = (): ThunkAction<any, State, any, any> => async (
  dispatch,
  getState,
) => {
  const { sessionInfo } = getState()
  for (let [id, info] of Object.entries(sessionInfo)) {
    const ports: string[] = []
    if (info.nodePort) ports.push(info.nodePort)
    if (info.windowPort) ports.push(info.windowPort)

    const payloads = await Promise.all(
      ports.map(port =>
        fetch(`http://127.0.0.1:${port}/json`).then(res => res.json()),
      ),
    )

    const pages = payloads.flat() as PageInfo[]
    if (pages.length === 0) return

    const pageDict = {} as Dict<PageInfo>
    pages
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .forEach(page => {
        pageDict[page.id] = page
      })

    dispatch(updatePages(id, pageDict))
  }
}

export const startDebugging =  (
  app: AppInfo,
): ThunkAction<any, State, any, any> => async (dispatch, getState) => {
  const nodePort = await getPort()
  const windowPort = await getPort()

  const sp = spawn(app.exePath, [
    `--inspect=${nodePort}`,
    `--remote-debugging-port=${windowPort}`,
  ])

  const id = v4()
  dispatch(addSession(id, app.id, nodePort, windowPort))

  setTimeout(function(){
    CDP({port:nodePort},async client => {
      let count=0;
      let renew=false;

      ipcMain.on(`open_devtools_${app.id}`,(event,args)=>{
        async function openDev() {
          console.log(event);
          let res = await client.Runtime.evaluate({
            expression: `process.mainModule.require('electron').webContents.fromId(${args.id}).openDevTools()`
          });
          console.log(res);
        }
        if(!client.CLOSED)
          openDev();
      })

      let interval=setInterval(async function() {
        try{
          let length=await client.Runtime.evaluate({
            expression: `process.mainModule.require('electron').webContents.getAllWebContents().length`
          })

          if(renew || length.result.value!=count){
            count=length.result.value;
            let webcontents=await client.Runtime.evaluate({
              expression: `
            result=[]
            contents=process.mainModule.require('electron').webContents.getAllWebContents();
            for(let i=0;i<contents.length;i++){
              let cw=contents[i];
              if(cw.getURL().indexOf('chrome')!=0 && cw.getURL().indexOf('devtools')!=0)
              result.push({"id":cw.id,"url":cw.getURL(),"webPreferences":cw.getWebPreferences()})
            };
            JSON.stringify(result);
            `
            })
            renew=false;
            let webContents=JSON.parse(webcontents.result.value)
            console.log(webContents);
            for(let wc=0;wc<webContents.length;wc++){
              if(webContents[wc].url==""){
                renew=true;
              }
            }
            dispatch(updateContents(id,webContents))
          }
        }catch(e){
          console.log(e)
          clearInterval(interval)
        }
      },5000)
    })
  },1000)




  //dialog.showErrorBox('success','CDP started');

  sp.on('error', err => {
    dialog.showErrorBox(`Error: ${app.name}`, err.message)
  })

  sp.on('close', code => {
    // console.log(`child process exited with code ${code}`)
    dispatch(removeSession(id))
    // TODO: Remove temp app
  })

  const handleStdout = (isError = false) => (chunk: Buffer) => {
    const data = chunk.toString()
    // TODO: stderr colors
    dispatch(updateLog(id, data))
  }

  if (sp.stdout) {
    sp.stdout.on('data', handleStdout())
  }
  if (sp.stderr) {
    sp.stderr.on('data', handleStdout(true))
  }
}

export const detectApps = (
  adapter: Adapter,
): ThunkAction<any, State, any, any> => async dispatch => {
  dispatch(getAppStart())
  const apps = await adapter.readApps()
  const appInfo = {} as Dict<AppInfo>
  apps
    .filter((app): app is AppInfo => typeof app !== 'undefined')
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .forEach(app => {
      appInfo[app.id] = app
    })
  dispatch(getApps(appInfo))
}
