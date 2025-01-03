import { useEffect, useRef, useState } from "react";
import "./App.css";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";

// 設定ディレクトリ内のファイルをすべて読み込む(*.list と *.table)
async function get_list_file_names(settingDirPath: string): Promise<string[]> {
  const ret = await invoke<string[]>("get_list_file_names", {
    settingDirPath,
  });

  return ret;
}

async function get_table_file_names(settingDirPath: string): Promise<string[]> {
  return await invoke<string[]>("get_table_file_names", {
    settingDirPath,
  });
}

function create_text_field_and_button_page_component(
  text: string,
  path: string,
): React.FC {
  return () => {
    const [textarea_value, set_textarea_value] = useState(text);
    const [last_textarea_value, set_last_textarea_value] = useState(text); // 最後にセーブボタンを押された文字列

    const has_difference = textarea_value !== last_textarea_value;

    const class_when_has_diff = has_difference ? "border-orange-300" : "border-gray-300";
    const button_class_when_has_diff = has_difference ? "bg-orange-500 hover:bg-orange-700" : "bg-gray-500"
    

    return (
      <div className="mx-2">
        <label
          htmlFor="message"
          className="block my-1 text-sm font-medium text-gray-900 dark:text-white"
        >
          {path}
        </label>
        <textarea
          id="message"
          rows={4}
          className={`block my-2 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border ${class_when_has_diff} focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500`}
          placeholder={textarea_value}
          value={textarea_value}
          onChange={(e) => {
            set_textarea_value(e.target.value);
          }}
        >
        </textarea>
        <button 
          disabled={!has_difference}
          className={`my-1 ${button_class_when_has_diff} text-white font-bold py-1 px-2 rounded-full text-sm`}
          onClick={async () => {
            set_last_textarea_value(textarea_value);
            await writeTextFile(path, textarea_value);
          }}
          >
          save
        </button>
      </div>
    );
  };
}

function create_table_page_component(path: string): React.FC {
  return () => {
    // サンプルコード
    const v: number[][] = [];
    for (let i = 0; i < 100; i++) {
      const vv: number[] = [];
      for (let j = 0; j < 100; j++) {
        vv.push(j);
      }
      v.push(vv);
    }

    return (
      <div className="mx-2">
        <label
          htmlFor="message"
          className="block my-1 text-sm font-medium text-gray-900 dark:text-white"
        >
          {path}
        </label>
        <table className="table-fixed">
          {
            /*
          <thead>
            <tr>
              {some_data[0].}
            </tr>
          </thead>
          */
          }
          <tbody>
            {v.map((vv) => <tr>{vv.map((d) => <td>{d}</td>)}</tr>)}
          </tbody>
        </table>
      </div>
    );
  };
}

const ACTIV_LI_A_CLASS: string =
  "inline-flex items-center justify-center p-4 border-b-2 text-blue-600 border-blue-600 rounded-t-lg active dark:text-blue-500 dark:border-blue-500 group";
const DEACTIV_LI_A_CLASS: string =
  "inline-flex items-center justify-center p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 group";

const ACTIV_SVG_CLASS: string = "w-4 h-4 me-2 text-blue-600 dark:text-blue-500";
const DEACTIV_SVG_CLASS: string =
  "w-4 h-4 me-2 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-300";

interface Tab {
  represent_name: string; // Tab に表示する名前
  svg_path_d: string;
  Page: React.FC;
}

function App() {
  // 初期化関数内で useState を使用したいので、useState をあらかじめ使用しておく
  const [tabs, setTabs] = useState<Tab[]>([]);

  const [selectedTab, setSelectedTab] = useState(0);

  // React 18 では useEffect を Strict Mode で実行すると useEffect に設定した関数が 2 回呼ばれてしまう。
  // その対策として useRef と useEffect を使用して 1 回だけ読み込む
  const hasRun = useRef(false);
  const readSettingsDir = async () => { // ファイルを読み込む非同期処理
    const file_path = await open({
      multiple: false,
      directory: true,
    });

    if (file_path === null) {
      alert("ディレクトリが選択されませんでした");
      return;
    }

    const tabs_tmp: Tab[] = [];

    const list_file_pathes = await get_list_file_names(file_path);

    for (const path of list_file_pathes) {
      const text = await readTextFile(
        path, /* { baseDir: BaseDirectory.AppConfig } */
      );
      tabs_tmp.push({
        represent_name: "list",
        svg_path_d:
          "M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 13a8.949 8.949 0 0 1-4.951-1.488A3.987 3.987 0 0 1 9 13h2a3.987 3.987 0 0 1 3.951 3.512A8.949 8.949 0 0 1 10 18Z",
        Page: create_text_field_and_button_page_component(text, path),
      });
    }

    const table_file_name = await get_table_file_names(file_path);

    for (const path of table_file_name) {
      const text = await readTextFile(
        path,
      );
      tabs_tmp.push({
        represent_name: "table",
        svg_path_d:
          "M16 1h-3.278A1.992 1.992 0 0 0 11 0H7a1.993 1.993 0 0 0-1.722 1H2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Zm-3 14H5a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2Zm0-4H5a1 1 0 0 1 0-2h8a1 1 0 1 1 0 2Zm0-5H5a1 1 0 0 1 0-2h2V2h4v2h2a1 1 0 1 1 0 2Z",
        Page: create_table_page_component(path),
      });
    }
    // 可能な限り 1 回で配列を更新
    setTabs([...tabs, ...tabs_tmp]);
  };
  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      readSettingsDir();
    }
    // useEffect で depecndency を空の配列にすると eslint の影響で warning が出てしまう。これを回避するために
    // 下記行を指定して warning を消す
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 初期化用の useEffect の前に下記の処理が実行される場合があり、参照先の配列の数が 0 の場合があり
  // 初期設定ができない可能性がある
  if (tabs.length != 0) {
    /* アクティブなタブのページを取得する */
    const { Page } = tabs[selectedTab];

    return (
      <>
        <div className="border-b border-gray-200 dark:border-gray-700">
          <ul className="flex flex-wrap -mb-px text-sm font-medium text-center text-gray-500 dark:text-gray-400">
            {tabs.map((tab, index) => (
              <li className="me-2" key={index}>
                <a
                  href="#"
                  className={index == selectedTab
                    ? ACTIV_LI_A_CLASS
                    : DEACTIV_LI_A_CLASS}
                  onClick={() => setSelectedTab(index)}
                >
                  <svg
                    className={index == selectedTab
                      ? ACTIV_SVG_CLASS
                      : DEACTIV_SVG_CLASS}
                    aria-hidden="true"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="currentColor"
                    viewBox={index == selectedTab ? "0 0 18 18" : "0 0 20 20"}
                  >
                    <path d={tab.svg_path_d} />
                  </svg>
                  {tab.represent_name}
                </a>
              </li>
            ))}
          </ul>
        </div>{" "}
        <Page />
        {
          /*
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </div>
      <button onClick={greet}>Greet</button>
      */
        }
      </>
    );
  } else {
    return (
      <>
        <p>No Files</p>
      </>
    );
  }
}

export default App;
