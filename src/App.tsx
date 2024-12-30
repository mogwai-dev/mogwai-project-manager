import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import tauriLogo from './assets/tauri.svg'
import typescriptLogo from './assets/typescript.svg'
import './App.css'
import { invoke } from "@tauri-apps/api/core";


async function greet() {
  // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  alert(await invoke("greet", {
    name: "ABC",
  }));
}


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
        <a target="_blank">
          <img src={tauriLogo} className="logo react" alt="Tauri logo" />
        </a>
        <a target="_blank">
          <img src={typescriptLogo} className="logo react" alt="Typescript logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <button onClick={greet}>Greet</button>
      <p id="greet-msg"></p>
      <h1 className="text-3xl font-bold underline">
      Hello world!
      </h1>
    </>
  )
}

export default App
