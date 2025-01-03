import { useEffect, useRef, useState } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";

// 設定ディレクトリ内のファイルをすべて読み込む(*.list と *.table)
async function get_dir(path: string): Promise<string> {
  const ret = await invoke<string>("get_dir", {
    path,
  });

  return ret;
}

async function join_path(dirPath: string, fileName: string): Promise<string> {
  const ret = await invoke<string>("join_path", {
    dirPath,
    fileName,
  });

  return ret;
}

// ヘッダーとなる部分を抽出する
function extract_header_element(list_text: string): string[] {
  const lines = list_text.split("\n");
  const words_splited_with_comma = lines
    .map<string[]>((v) => v.split(","))
    .map<string[]>((v) => v.map<string>((vv) => vv.trim()));

  const id_and_key = words_splited_with_comma.map<string>((v) =>
    v[0] + ", " + v[v.length - 1]
  );

  return id_and_key;
}

const generate_table_page = (path: string) => {
  return () => {
    const [header_element, set_header_element] = useState<string[]>([]);

    const hasRun = useRef(false);
    const initialize = async () => {
      let header_element_tmp: string[] = [];
      const text = await readTextFile(path);
      // 先頭のコメントを読み込むが
      // 1 行目は飛ばす
      let should_read = false; // すでにスキップしたか. スキップしたら true
      const splited = text.split("\n");
      for (const line of splited) {
        if (should_read) {
          if (line.startsWith("'")) {
            const file_name = line.slice(1).trim();
            const dir_name = await get_dir(path);
            const file_path = await join_path(dir_name, file_name);

            const list_text = await readTextFile(file_path);
            header_element_tmp = header_element_tmp.concat(extract_header_element(list_text));
          } else {
            break;
          }
        } else {
          should_read = true;
        }
      }

      set_header_element([...header_element, ...header_element_tmp]);
    };

    useEffect(() => {
      if (!hasRun.current) {
        hasRun.current = true;
        initialize();
      }

      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 空の依存配列により、コンポーネントのマウント時にのみ実行される
    return (
      <div className="mx-2">
        <label
          htmlFor="message"
          className="block my-1 text-sm font-medium text-gray-900 dark:text-white"
        >
          Sample
        </label>
        <table className="table-fixed">
          <thead>
            <tr>
              {["(空欄)"].concat(header_element).map((e) => <td>{e}</td>)}
            </tr>
          </thead>
          <tbody>
            {header_element.map((e) => (
              <tr>
                <td>{e}</td>

                {header_element.map(
                  (_d) => <td>-</td>,
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };
};

export default generate_table_page;
