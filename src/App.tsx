import { useEffect, useRef, useState } from "react";
import "./App.css";
import { open } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { TablePage } from "./TablePage";
import { ListPage } from "./ListPage";

// 設定ディレクトリ内のファイルをすべて読み込む(*.list と *.table)
async function getListFileNames(settingDirPath: string): Promise<string[]> {
  const ret = await invoke<string[]>("get_list_file_names", {
    settingDirPath,
  });

  return ret;
}

async function getTableFileNames(settingDirPath: string): Promise<string[]> {
  return await invoke<string[]>("get_table_file_names", {
    settingDirPath,
  });
}

async function getFileNameFromPath(path: string): Promise<string> {
  return await invoke<string>("get_file_name_from_path", {
    path
  });
}

const ACTIV_LI_A_CLASS: string =
  "inline-flex items-center justify-center p-4 border-b-2 text-blue-600 border-blue-600 rounded-t-lg active dark:text-blue-500 dark:border-blue-500 group";
const DEACTIV_LI_A_CLASS: string =
  "inline-flex items-center justify-center p-4 border-b-2 border-transparent rounded-t-lg hover:text-gray-600 hover:border-gray-300 dark:hover:text-gray-300 group";

const ACTIV_SVG_CLASS: string = "w-4 h-4 me-2 text-blue-600 dark:text-blue-500";
const DEACTIV_SVG_CLASS: string =
  "w-4 h-4 me-2 text-gray-400 group-hover:text-gray-500 dark:text-gray-500 dark:group-hover:text-gray-300";

interface Tab {
  representName: string; // Tab に表示する名前
  svgPathD: string;
  Page: JSX.Element;
}

function App() {
  // 初期化関数内で useState を使用したいので、useState をあらかじめ使用しておく
  const [tabs, setTabs] = useState<Tab[]>([]);

  const [selectedTab, setSelectedTab] = useState(0);

  // React 18 では useEffect を Strict Mode で実行すると useEffect に設定した関数が 2 回呼ばれてしまう。
  // その対策として useRef と useEffect を使用して 1 回だけ読み込む
  const hasRun = useRef(false);
  const initialize = async () => { // ファイルを読み込む非同期処理
    const filePath = await open({
      multiple: false,
      directory: true,
    });

    if (filePath === null) {
      alert("ディレクトリが選択されませんでした");
      return;
    }

    const tabsTmp: Tab[] = [];

    const listFilePathes = await getListFileNames(filePath);

    for (const path of listFilePathes) {
      const text = await readTextFile(
        path, /* { baseDir: BaseDirectory.AppConfig } */
      );
      tabsTmp.push({
        representName: await getFileNameFromPath(path),
        svgPathD:
          "M10 0a10 10 0 1 0 10 10A10.011 10.011 0 0 0 10 0Zm0 5a3 3 0 1 1 0 6 3 3 0 0 1 0-6Zm0 13a8.949 8.949 0 0 1-4.951-1.488A3.987 3.987 0 0 1 9 13h2a3.987 3.987 0 0 1 3.951 3.512A8.949 8.949 0 0 1 10 18Z",
        Page: <ListPage text={text} path={path} />
      });
    }

    const tableFileName = await getTableFileNames(filePath);

    for (const path of tableFileName) {
      await readTextFile(
        path,
      );
      tabsTmp.push({
        representName: await getFileNameFromPath(path),
        svgPathD:
          "M16 1h-3.278A1.992 1.992 0 0 0 11 0H7a1.993 1.993 0 0 0-1.722 1H2a2 2 0 0 0-2 2v15a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V3a2 2 0 0 0-2-2Zm-3 14H5a1 1 0 0 1 0-2h8a1 1 0 0 1 0 2Zm0-4H5a1 1 0 0 1 0-2h8a1 1 0 1 1 0 2Zm0-5H5a1 1 0 0 1 0-2h2V2h4v2h2a1 1 0 1 1 0 2Z",
        Page: <TablePage path={path} />
      });
    }
    // 可能な限り 1 回で配列を更新
    setTabs([...tabs, ...tabsTmp]);
  };
  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      initialize();
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
                    <path d={tab.svgPathD} />
                  </svg>
                  {tab.representName}
                </a>
              </li>
            ))}
          </ul>
        </div>{" "}
        {Page}

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
