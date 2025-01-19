import {
  Dispatch,
  FC,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  HeaderInfo,
  TablePageInfo,
} from "./TablePage";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { extractHeaderElement, getDir, joinPath } from "./util";

interface ListFileChooser {
  initialFilePathes: string[];
  setTablePageInfo: Dispatch<SetStateAction<TablePageInfo>>;
  oldFileNames: string[];
  path: string;
  tablePageInfoNow: TablePageInfo;
}

function isValidListFiles(
  textContent: string,
): [boolean, string[] | undefined] {

  if (textContent === "") {
    return [true, undefined]
  }

  let splited = textContent.split("+");

  splited = splited.map((c) => c.trim());

  let res = true;
  for (const s of splited) {
    if (!s.endsWith(".list")) {
      res &&= false;
    }
  }

  return [res, res ? splited : undefined];
}

export const ListFileChooser: FC<ListFileChooser> = (
  { initialFilePathes, setTablePageInfo, oldFileNames, path, tablePageInfoNow },
) => {
  const [textContent, setTextContent] = useState<string>(
    initialFilePathes.join(" + "),
  );

  const hasRun = useRef(false);
  const initialize = async () => {
    setTextContent(initialFilePathes.join(" + "))
  };

  useEffect(() => {
    if (!hasRun.current) {
      hasRun.current = true;
      initialize();
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  
  const [isTextContentOk, newFilePathes] = isValidListFiles(textContent);

  const border = isTextContentOk ? "border-gray-300" : "border-red-300";

  return (
    <div className="flex items-center w-full">
      <input
        type="text"
        className={`px-4 py-2 flex-grow border ${border} text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
        placeholder="Enter text"
        defaultValue={initialFilePathes.join(" + ")}
        onChange={(e) => {
          setTextContent(e.target.value);
        }}
      />
      <button
        disabled={!isTextContentOk}
        className="px-4 py-2 text-white text-sm bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        onClick={async () => {
          if (newFilePathes !== undefined) {
            // テーブルファイル内のリストファイルが更新された
            if (
              JSON.stringify(oldFileNames) !== JSON.stringify(newFilePathes)
            ) {
              const headerInfo: HeaderInfo = new Map();
              for (const fileName of newFilePathes) {
                const dirName = await getDir(path);

                const filePath = await joinPath(dirName, fileName);

                const listText = await readTextFile(filePath);

                headerInfo.set(fileName, {
                  headerElements: extractHeaderElement(fileName, listText),
                  isRowOpen: true,
                  isColOpen: true,
                });
              }

              tablePageInfoNow.headerInfo = headerInfo;
              setTablePageInfo({...tablePageInfoNow});
            }
          }
        }}
      >
        Submit
      </button>
    </div>
  );
};
