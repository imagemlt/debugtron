import React, { useEffect, useState } from 'react'
import { ipcRenderer } from 'electron'
import { useDropzone } from 'react-dropzone'
import {
  Tabs,
  Tab,
  Divider,
  Pre,
  Tag,
  Spinner,
  HTMLTable,
  Button,
} from '@blueprintjs/core'
import { useSelector } from 'react-redux'
import { State } from '../reducers'
import './app.css'

export const App: React.FC = () => {
  const [activeId, setActiveId] = useState('')
  const { appInfo, sessionInfo, appLoading } = useSelector<State, State>(s => s)
  const { getRootProps, getInputProps } = useDropzone({
    noClick: process.platform === 'darwin',
    onDropAccepted(files) {
      if (files.length === 0) return
      ipcRenderer.send('startDebuggingWithExePath', files[0].path)
    },
    async getFilesFromEvent(e: any) {
      // Drop
      if (e.dataTransfer && e.dataTransfer.files) {
        const fileList = e.dataTransfer.files as FileList
        return [...fileList]
      }

      // Click
      if (e.target && e.target.files) {
        const fileList = e.target.files as FileList
        return [...fileList]
      }

      return []
    },
  })

  useEffect(() => {
    const sessionIds = Object.keys(sessionInfo)

    // Ensure there always be one tab active
    if (!sessionIds.includes(activeId) && sessionIds.length) {
      setActiveId(sessionIds[0])
    }
  }, [activeId, sessionInfo])

  const sessionEntries = Object.entries(sessionInfo)
  // console.log(appInfo, sessionInfo)

  return (
    <div
      style={{
        height: '100vh',
        padding: '1px 8px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3>
        Installed Electron-based App (Click to debug){'  '}
        <Button
          small
          icon="refresh"
          onClick={() => {
            ipcRenderer.send('detectApps')
          }}
        >
          Refresh
        </Button>
      </h3>
      <div style={{ display: 'flex' }}>
        {appLoading ? (
          <Spinner />
        ) : (
          <div style={{ display: 'flex', flexGrow: 1, overflowX: 'auto' }}>
            {Object.entries(appInfo).map(([id, app]) => {
              if (app.hidden) return null

              return (
                <a
                  key={id}
                  href="#"
                  onClick={e => {
                    e.preventDefault()
                    ipcRenderer.send('startDebugging', app.id)
                  }}
                  style={{ padding: 4, textAlign: 'center', width: 100 }}
                  className="hoverable"
                >
                  <img
                    src={app.icon || require('./images/electron.png')}
                    style={{ width: 64, height: 64 }}
                  />
                  <div style={{ wordBreak: 'break-word' }}>{app.name}</div>
                </a>
              )
            })}
          </div>
        )}
        <Divider />
        <div
          {...getRootProps({
            style: {
              padding: 20,
              borderWidth: 2,
              borderRadius: 2,
              borderColor: '#eeeeee',
              borderStyle: 'dashed',
              backgroundColor: '#fafafa',
              color: '#aaa',
              outline: 'none',
              transition: 'border 0.24s ease-in-out',
              display: 'flex',
              marginTop: 10,
              marginBottom: 10,
              cursor: 'pointer',
            },
          })}
        >
          <input {...getInputProps()} />
          <p style={{ alignSelf: 'center' }}>
            App not found? Drag your app here
          </p>
        </div>
      </div>

      <Divider />

      <div style={{ overflowY: 'auto' }}>
        {sessionEntries.length ? (
          <Tabs
            selectedTabId={activeId}
            onChange={key => {
              setActiveId(key as string)
            }}
          >
            {sessionEntries.map(([id, session]) => (
              <Tab
                id={id}
                key={id}
                title={appInfo[session.appId].name}
                panel={
                  <div style={{ display: 'flex', marginTop: -20 }}>
                    <div>
                      <h3>Sessions (Click to open)</h3>
                      <HTMLTable condensed interactive>
                        <thead>
                          <tr>
                            <th>Type</th>
                            <th>Title</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(session.pages).map(([id, page]) => (
                            <tr key={id}>
                              <td>
                                <Tag
                                  intent={
                                    page.type === 'node'
                                      ? 'success'
                                      : page.type === 'page'
                                      ? 'primary'
                                      : 'none'
                                  }
                                >
                                  {page.type}
                                </Tag>
                              </td>
                              <td
                                style={{
                                  maxWidth: 200,
                                  wordWrap: 'break-word',
                                }}
                              >
                                {page.title}
                              </td>
                              <td>
                                <Button
                                  small
                                  rightIcon="share"
                                  onClick={() => {
                                    window.open(
                                      page.devtoolsFrontendUrl
                                        .replace(
                                          /^\/devtools/,
                                          'devtools://devtools/bundled',
                                        )
                                        .replace(
                                          /^chrome-devtools:\/\//,
                                          'devtools://',
                                        ),
                                    )
                                  }}
                                >
                                  Inspect
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </HTMLTable>
                    </div>
                    <Divider />
                    <Tabs
                      defaultSelectedTabId={'Log'}
                    >
                   <Tab
                     id={'webContents'}
                     key={'webContents'}
                     title={'webContents'}
                     panel={
                     <HTMLTable style={{
                       //flexGrow: 0,
                       //overflow: 'auto',
                       userSelect: 'text',
                       width: '50%',
                       fontFamily:
                         'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',

                     }} condensed interactive>

                       <thead>
                       <tr>
                         <th>Id</th>
                         <th>URL</th>
                         <th>nodeIntegration</th>
                         <th>contextIsolation</th>
                         <th>sandbox</th>
                         <th>nativeWindowOpen</th>
                         <th>webSecurity</th>
                         <th>webPreferences</th>
                       </tr>
                       </thead>
                       <tbody>
                       {session.webcontents == undefined  ? <tr></tr> : session.webcontents.map((webcontent) =>webcontent.url.indexOf("chrome") != 0 && (
                         <tr key={webcontent.id}>
                           <td
                             style={{
                               maxWidth: 200,
                               wordWrap: 'break-word',
                             }}
                           >
                             <Button
                               small
                               icon="share"
                               onClick={() => {
                                 console.log(session.appId)
                                 ipcRenderer.send(`open_devtools_${session.appId}`, { id: webcontent.id })
                               }}
                             >
                               {webcontent.id}
                             </Button>

                           </td>
                           <td
                             style={{
                               maxWidth: 200,
                               wordWrap: 'break-word',
                             }}
                           >
                             {webcontent.url}
                           </td>
                           <td
                             style={{
                               maxWidth: 100,
                               wordWrap: 'break-word',
                               color: webcontent.webPreferences.nodeIntegration == true ? 'red' : 'black',
                             }}
                           >
                             {webcontent.webPreferences.nodeIntegration ? "true" : "false"}
                           </td>
                           <td
                             style={{
                               maxWidth: 100,
                               wordWrap: 'break-word',
                               color: webcontent.webPreferences.contextIsolation == false ? 'red' : 'black',
                             }}
                           >
                             {webcontent.webPreferences.contextIsolation ? "true" : "false"}
                           </td>
                           <td
                             style={{
                               maxWidth: 100,
                               wordWrap: 'break-word',
                               color: webcontent.webPreferences.sandbox == false ? 'red' : 'black',
                             }}
                           >
                             {webcontent.webPreferences.sandbox ? "true" : "false"}
                           </td>
                           <td
                             style={{
                               maxWidth: 100,
                               wordWrap: 'break-word',
                               color: webcontent.webPreferences.nativeWindowOpen == false ? 'red' : 'black',
                             }}
                           >
                             {webcontent.webPreferences.nativeWindowOpen ? "true" : "false"}
                           </td>
                           <td
                             style={{
                               maxWidth: 100,
                               wordWrap: 'break-word',
                               color: webcontent.webPreferences.webSecurity == false ? 'red' : 'black',
                             }}
                           >
                             {webcontent.webPreferences.webSecurity ? "true" : "false"}
                           </td>
                           <td
                             style={{
                               maxWidth: 400,
                               //wordWrap: 'break-word',
                               overflow: 'scroll'
                             }}
                           >
                             {JSON.stringify(webcontent.webPreferences)}
                           </td>
                         </tr>
                       ))}
                       </tbody>
                     </HTMLTable>
                   }>
                   </Tab>
                      <Tab
                        id={'Log'}
                        key={'Log'}
                        title={'Log'}
                        style={{
                          marginTop:0,
                        }}
                        panel={
                        <Pre
                          style={{
                            flexGrow: 1,
                            overflow: 'auto',
                            userSelect: 'text',
                            fontFamily:
                              'SFMono-Regular, Consolas, Liberation Mono, Menlo, monospace',
                          }}
                        >
                          {session.log}
                        </Pre>
                      }>
                      </Tab>
                    </Tabs>
                  </div>
                }
              />
            ))}
          </Tabs>
        ) : (
          <div
            style={{
              fontSize: 24,
              color: '#bbb',
              width: '100%',
              height: '100%',
              paddingTop: 100,
              textAlign: 'center',
            }}
          >
            Click App icon to debug
          </div>
        )}
      </div>
    </div>
  )
}
