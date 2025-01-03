import { useEffect, useRef, useState } from "react";
import { readTextFile } from "@tauri-apps/plugin-fs";
import { invoke } from "@tauri-apps/api/core";
import { Tooltip } from "react-tooltip";

// デバッグ用制御変数
const SHOW_TABLE_INFO: boolean = true;

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

interface HeaderElement {
  file_name: string;
  id: string; // unique な数値
  represent_name: string; // 表示する名前
}

// ヘッダーとなる部分を抽出する
function extract_header_element(
  file_name: string,
  list_text: string,
): HeaderElement[] {
  const lines = list_text.split("\n").map((line) => line.trim());
  const words_splited_with_comma = lines
    .map<string[]>((v) => v.split(","))
    .map<string[]>((v) => v.map<string>((vv) => vv.trim()));

  const id_and_key: HeaderElement[] = words_splited_with_comma.map<
    HeaderElement
  >((v) => {
    return {
      file_name,
      id: v[0],
      represent_name: v[v.length - 1],
    };
  });

  return id_and_key;
}

// matrix["x.list:1"]["y.list:1"] = 'o' みたいな....
type Matrix = { [row_key: string]: { [column_key: string]: MatrixValue } };
type MatrixValue = { mark: string; description: string };

function register_arrow(
  matrix: Matrix,
  row_key: string,
  col_key: string,
  description: string,
  mark: string,
) {
  if (!matrix[row_key]) {
    matrix[row_key] = {};
  }

  if (!matrix[row_key][col_key]) {
    matrix[row_key][col_key] = { mark: "", description: "" };
  }

  matrix[row_key][col_key] = { mark, description };
}

function get_mark(
  matrix: Matrix,
  row_key: string,
  col_key: string,
): MatrixValue {
  if (!matrix[row_key]) {
    matrix[row_key] = {};
  }

  if (!matrix[row_key][col_key]) {
    matrix[row_key][col_key] = { mark: "", description: "" };
  }

  return matrix[row_key][col_key];
}

enum ReadState {
  SkipInitialLine,
  ReadFileName,
  ReadArrow,
}

const generate_table_page = (path: string) => {
  return () => {
    const [header_elements, set_header_element] = useState<HeaderElement[]>([]);
    const [matrix, set_matrix] = useState<Matrix>({});

    const hasRun = useRef(false);
    const initialize = async () => {
      let header_element_tmp: HeaderElement[] = [];
      const matrix_tmp: Matrix = {};

      const text = await readTextFile(path);
      // 先頭のコメントを読み込むが
      // 1 行目は飛ばす
      let read_state: ReadState = ReadState.SkipInitialLine;
      const splited = text.split("\n").map((line) => line.trim());
      let line_num = 0; // 現在読んでいる行数
      // 現在読んでいる行数が "\n" で分けた行数より大きくなったら終わり
      while (line_num < splited.length) {
        const line = splited[line_num];

        if (read_state === ReadState.SkipInitialLine) {
          read_state = ReadState.ReadFileName;
          line_num += 1;
        } else if (read_state === ReadState.ReadFileName) {
          if (line.startsWith("'")) {
            const file_name = line.slice(1).trim();
            const dir_name = await get_dir(path);
            const file_path = await join_path(dir_name, file_name);

            const list_text = await readTextFile(file_path);
            header_element_tmp = header_element_tmp.concat(
              extract_header_element(file_name, list_text),
            );
            line_num += 1;
          } else {
            read_state = ReadState.ReadArrow;
          }
        } else if (read_state === ReadState.ReadArrow) {
          if (line.includes("-->") || line.includes("<--")) {
            const splited_with_space = line.split(" ");

            const [file_name_left, id_left] = splited_with_space[0].split(":");
            const [file_name_right, id_right] = splited_with_space[2].split(
              ":",
            );

            let description;
            // コメントの抽出(簡易版)
            if (line.includes("'")) {
              description = line.slice(line.lastIndexOf("'")).slice(1).trim();
            } else {
              description = "";
            }

            if (splited_with_space[1] === "-->") {
              register_arrow(
                matrix_tmp,
                `${file_name_left}:${id_left}`,
                `${file_name_right}:${id_right}`,
                description,
                "〇",
              );
            } else if (splited_with_space[1] === "<--") {
              register_arrow(
                matrix_tmp,
                `${file_name_right}:${id_right}`,
                `${file_name_left}:${id_left}`,
                description,
                "〇",
              );
            }
          }

          line_num += 1;
        }
      }

      set_header_element([...header_elements, ...header_element_tmp]);
      set_matrix(matrix_tmp);
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
          {path}
        </label>
        <table className="table-fixed">
          <thead>
            <tr key={"header_row_0"}>
              {["(空欄)"].concat(
                header_elements.map<string>((he) =>
                  !SHOW_TABLE_INFO
                    ? he.represent_name
                    : he.file_name + ":" + he.id + ":" + he.represent_name
                ),
              ).map((e, index) => <td key={`header_row_0_col_${index}`}>{e}
              </td>)}
            </tr>
          </thead>
          <tbody>
            {header_elements.map((he_row, index_row) => (
              <tr key={`content_row_${index_row}`}>
                <td>
                  {!SHOW_TABLE_INFO
                    ? he_row.represent_name
                    : he_row.file_name + ":" + he_row.id + ":" +
                      he_row.represent_name}
                </td>
                {header_elements.map(
                  (he_col, index_col) => (
                    <td
                      key={`content_row_${index_row}_col_${index_col}`}
                      {...(get_mark(
                          matrix,
                          he_row.file_name + ":" + he_row.id,
                          he_col.file_name + ":" + he_col.id,
                        ).description !== ""
                        ? {
                          "data-tooltip-id": "td-tooltip",
                          "data-tooltip-content": `${
                            get_mark(
                              matrix,
                              he_row.file_name + ":" + he_row.id,
                              he_col.file_name + ":" + he_col.id,
                            ).description
                          } ※ダブルクリックで編集できます`,
                        }
                        : "")}
                    >
                      {get_mark(
                        matrix,
                        he_row.file_name + ":" + he_row.id,
                        he_col.file_name + ":" + he_col.id,
                      ).mark ||
                        "-"}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
        <Tooltip id="td-tooltip" />
      </div>
    );
  };
};

export default generate_table_page;
