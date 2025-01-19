import {
  Dispatch,
  FC,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { Tooltip } from "react-tooltip";
import MyTooltip from "./MyTooltip";
import { ListFileChooser } from "./ListFileChooser";
import { extractHeaderElement, getDir, HeaderElement, joinPath } from "./util";

async function writeToTableFile(
  tablePageInfo: TablePageInfo,
) {
  let writeContent = "' リストファイル一覧\n";

  for (const read_file_name of tablePageInfo.headerInfo.keys()) {
    writeContent += `' ${read_file_name} \n`;
  }

  // 空行
  writeContent += "\n";

  for (const rowKey in tablePageInfo.matrix.matrix) {
    for (const colKey in tablePageInfo.matrix.matrix[rowKey]) {
      if (
        tablePageInfo.matrix.matrix[rowKey][colKey].mark !== "" &&
        tablePageInfo.matrix.matrix[rowKey][colKey].mark !== "-"
      ) {
        writeContent += `${rowKey} --> ${colKey} ' ${
          tablePageInfo.matrix.matrix[rowKey][colKey].description.replace(
            "\r\n",
            " ",
          )
            .replace("\n", " ")
        }\n`;
      }
    }
  }

  await writeTextFile(tablePageInfo.tableFilePath, writeContent);
}

// テーブルのセル
class Cell {
  value: string | undefined;
  attrs: { [attr: string]: string }; // 属性の名前: その設定値
  isActive: boolean;
  onClick: () => void;
  onDblClick: () => void;
  protected key: string;

  constructor(key: string) {
    this.attrs = { "className": "border text-center" };
    this.isActive = true;
    this.onClick = () => {};
    this.onDblClick = () => {};
    this.key = key;
  }

  setValue(value: string) {
    this.value = value;
  }

  setOnClick(onClick: () => void) {
    this.onClick = onClick;
  }

  setOnDblClick(onDblClick: () => void) {
    this.onDblClick = onDblClick;
  }

  setIsActive(isActive: boolean) {
    this.isActive = isActive;
  }

  getIsActive(): boolean {
    return this.isActive;
  }

  getKey(): string {
    return this.key;
  }

  setAttr(attr: string, value: string) {
    this.attrs[attr] = value;
  }

  paintSelf() {
    this.attrs["className"] += " bg-orange-100";
  }

  asJsx(): JSX.Element {
    return (
      <td
        key={this.key}
        onClick={this.onClick}
        onDoubleClick={this.onDblClick}
        {...this.attrs}
      >
        {this.value}
      </td>
    );
  }
}

class HeaderCell extends Cell {
  constructor(key: string) {
    super(key);
  }

  asJsx(): JSX.Element {
    return (
      <th key={this.key} onClick={this.onClick} {...this.attrs}>
        {this.value}
      </th>
    );
  }
}

interface ClickedPosition {
  row: number;
  col: number;
}

// テーブル
class Table {
  table: Cell[][];
  tablePageInfo: TablePageInfo;
  dblClickedData: DblClickedData | undefined;
  update: Dispatch<SetStateAction<TablePageInfo>>;
  updateDblClickedData: Dispatch<SetStateAction<DblClickedData | undefined>>;

  constructor(
    tablePageInfo: TablePageInfo,
    dblClickedData: DblClickedData | undefined,
    update: Dispatch<SetStateAction<TablePageInfo>>,
    updateDblClickedData: Dispatch<SetStateAction<DblClickedData | undefined>>,
  ) {
    this.tablePageInfo = tablePageInfo;
    this.dblClickedData = dblClickedData;
    this.update = update;
    this.updateDblClickedData = updateDblClickedData;

    let initRow: number = 2; // ヘッダーが 2 段になるので + 2
    let initCol: number = 2; // ヘッダーが 2 段になるので + 2

    for (const k of this.tablePageInfo.headerInfo.keys()) {
      // row
      if (this.tablePageInfo.headerInfo.get(k)?.isRowOpen) {
        initRow += this.tablePageInfo.headerInfo.get(k)!.headerElements.length;
      } else {
        initRow += 1; // headerElements が 1 にまとまって ファイル名のみとなる
      }

      // col
      if (this.tablePageInfo.headerInfo.get(k)?.isColOpen) {
        initCol += this.tablePageInfo.headerInfo.get(k)!.headerElements.length;
      } else {
        initCol += 1; // headerElements が 1 にまとまって ファイル名のみとなる
      }
    }

    /* 行列の初期化 */
    this.table = [];

    for (let i = 0; i < initRow; i++) {
      this.table[i] = [];
      for (let j = 0; j < initCol; j++) {
        // 1 行目, 2 行目 は header
        if (i == 0 || i == 1 || j == 0 || j == 1) {
          this.table[i].push(new HeaderCell(`header_row_${i}_col_${j}`));
        } else {
          this.table[i].push(new Cell(`content_row_${i}_col_${j}`));
        }
      }
    }
  }

  setAttrAt(row: number, col: number, attrs: { [attr: string]: string }) {
    for (const attr in attrs) {
      this.table[row][col].setAttr(attr, attrs[attr]);
    }
  }

  setContentValueAt(
    row: number,
    col: number,
    value: string,
    description: string,
  ) {
    if (this.dblClickedData === undefined) {
      this.table[row][col].setAttr("data-tooltip-id", "td-tooltip");
      this.table[row][col].setAttr("data-tooltip-content", description);
    } else {
      this.table[row][col].setAttr("data-tooltip-id", this.getKeyAt(row, col));
    }

    this.table[row][col].setValue(value);
  }

  setFileNameAtCol(row: number, col: number, fileName: string) {
    const onClick: () => void = () => {
      this.tablePageInfo.headerInfo.get(fileName)!.isColOpen = !this
        .tablePageInfo.headerInfo.get(fileName)!.isColOpen;
      this.update({ ...this.tablePageInfo });
    };
    this.table[row][col].setOnClick(onClick);

    if (this.tablePageInfo.headerInfo.get(fileName)!.isColOpen) {
      this.table[row][col].setValue("▼" + fileName);
    } else {
      this.table[row][col].setValue("▶" + fileName);
    }
  }

  setOnClickCloseImpactScopeDisplayMode(row: number, col: number) {
    let onClick: () => void;
    if (this.tablePageInfo.impactScopeDisplayMode) {
      onClick = () => {
        this.tablePageInfo.impactScopeDisplayMode = false;
        this.tablePageInfo.matrix.clearImpactScope();
        this.update({ ...this.tablePageInfo });
      };
    } else {
      onClick = () => {
      };
    }

    this.table[row][col].setOnClick(onClick);
  }

  setContentOnClick(row: number, col: number, ColKey: string) {
    let onClick: () => void;

    if (this.tablePageInfo.impactScopeDisplayMode) {
      if (
        this.tablePageInfo.clickedPosition.row === row &&
        this.tablePageInfo.clickedPosition.col === col
      ) {
        onClick = () => {
          /* なにもしない */
        };
      } else {
        /* クリックされた別のところがクリックされた */
        onClick = () => {
          this.tablePageInfo.impactScopeDisplayMode = false;
          this.tablePageInfo.matrix.clearImpactScope();
          this.update({ ...this.tablePageInfo });
        };
      }
    } else {
      onClick = () => {
        this.tablePageInfo.impactScopeDisplayMode = true;
        this.tablePageInfo.matrix.calcurateImpactScope(ColKey);
        this.tablePageInfo.clickedPosition.row = row;
        this.tablePageInfo.clickedPosition.col = col;
        this.update({ ...this.tablePageInfo });
      };
    }

    this.table[row][col].setOnClick(onClick);
  }

  setFileNameAtRow(row: number, col: number, fileName: string) {
    const onClick: () => void = () => {
      this.tablePageInfo.headerInfo.get(fileName)!.isRowOpen = !this
        .tablePageInfo.headerInfo.get(fileName)!.isRowOpen;
      this.update({ ...this.tablePageInfo });
    };
    this.table[row][col].setOnClick(onClick);

    if (this.tablePageInfo.headerInfo.get(fileName)!.isRowOpen) {
      this.table[row][col].setValue("▼" + fileName);
    } else {
      this.table[row][col].setValue("▶" + fileName);
    }
  }

  setValueAt(row: number, col: number, value: string) {
    this.table[row][col].setValue(value);
    this.table[row][col].setAttr("data-tooltip-id", this.getKeyAt(row, col));
  }

  getKeyAt(row: number, col: number): string {
    return this.table[row][col].getKey();
  }

  paintAt(row: number, col: number) {
    this.table[row][col].paintSelf();
  }

  // (fromRow, fromCol) のセルから (toRow, toCol) までのセルを結合させる
  mergeCell(fromRow: number, fromCol: number, toRow: number, toCol: number) {
    const fromRowTmp = Math.min(fromRow, toRow);
    const toRowTmp = Math.max(fromRow, toRow);
    const fromColTmp = Math.min(fromCol, toCol);
    const toColTmp = Math.max(fromCol, toCol);

    for (let r = fromRowTmp; r <= toRowTmp; r++) {
      for (let c = fromColTmp; c <= toColTmp; c++) {
        if (r == fromRowTmp && c == fromColTmp) {
          // 結合セルの最初
          this.table[r][c].setIsActive(true);
          this.table[r][c].setAttr(
            "rowSpan",
            (toRowTmp - fromRowTmp + 1).toString(),
          );
          this.table[r][c].setAttr(
            "colSpan",
            (toColTmp - fromColTmp + 1).toString(),
          );
        } else {
          this.table[r][c].setIsActive(false);
        }
      }
    }
  }

  // table の jsx を生成する
  asJsx(): JSX.Element {
    this.setValueAt(0, 0, "(空欄)");
    this.mergeCell(0, 0, 1, 1); // 空欄

    // ヘッダー 0, 1 行目の設定
    let colAtRow0 = 2;
    for (const fileName of this.tablePageInfo.headerInfo.keys()) {
      if (this.tablePageInfo.headerInfo.get(fileName)!.isColOpen) {
        // 0 行目の設定
        this.mergeCell(
          0,
          colAtRow0,
          0,
          colAtRow0 +
            this.tablePageInfo.headerInfo.get(fileName)!.headerElements.length -
            1,
        );
        this.setFileNameAtCol(0, colAtRow0, fileName);

        // 1 行目の設定
        let colAtRow1 = colAtRow0;
        for (
          const element of this.tablePageInfo.headerInfo.get(fileName)!
            .headerElements
        ) {
          this.table[1][colAtRow1].setIsActive(true);
          this.setValueAt(1, colAtRow1, element.repr());
          colAtRow1 += 1;
        }

        colAtRow0 +=
          this.tablePageInfo.headerInfo.get(fileName)!.headerElements.length;
      } else {
        // close

        this.setFileNameAtCol(0, colAtRow0, fileName);

        colAtRow0 += 1; // 閉じているので 1 列に設定する
      }
    }

    // ヘッダー 0, 1 列目の値の設定
    let rowAtCol0 = 2;
    for (const fileName of this.tablePageInfo.headerInfo.keys()) {
      if (this.tablePageInfo.headerInfo.get(fileName)!.isRowOpen) {
        // 0 列目
        this.mergeCell(
          rowAtCol0,
          0,
          rowAtCol0 +
            this.tablePageInfo.headerInfo.get(fileName)!.headerElements.length -
            1,
          0,
        );

        this.setFileNameAtRow(rowAtCol0, 0, fileName);

        // 1 列目
        let rowAtCol1 = rowAtCol0;
        for (
          const element of this.tablePageInfo.headerInfo.get(fileName)!
            .headerElements
        ) {
          this.table[rowAtCol1][1].setIsActive(true);
          this.setValueAt(rowAtCol1, 1, element.repr());
          rowAtCol1 += 1;
        }

        rowAtCol0 +=
          this.tablePageInfo.headerInfo.get(fileName)!.headerElements.length;
      } else {
        // close
        this.setFileNameAtRow(rowAtCol0, 0, fileName);
        this.setValueAt(rowAtCol0, 1, "");

        rowAtCol0 += 1; // 閉じているので 1 列に設定する
      }
    }

    // ヘッダーじゃない部分の設定
    let fileBaseCol = 0; // ファイル間のテーブルが始まる位置
    let fileBaseRow = 0; // ファイル間のテーブルが始まる位置
    for (const fileNameRow of this.tablePageInfo.headerInfo.keys()) {
      for (const fileNameCol of this.tablePageInfo.headerInfo.keys()) {
        let contentCol = 0; // ファイル同士でのテーブル内でのインデックス
        let contentRow = 0; // ファイル同士でのテーブル内でのインデックス
        if (
          this.tablePageInfo.headerInfo.get(fileNameRow)!.isRowOpen &&
          this.tablePageInfo.headerInfo.get(fileNameCol)!.isColOpen
        ) {
          for (
            const heRow of this.tablePageInfo.headerInfo.get(fileNameRow)!
              .headerElements
          ) {
            // fileName の col が開いているとき
            for (
              const heCol of this.tablePageInfo.headerInfo.get(fileNameCol)!
                .headerElements
            ) {
              const matrixValue: MatrixValue = this.tablePageInfo.matrix
                .getMatrixValue(
                  heRow.matrixKey(),
                  heCol.matrixKey(),
                );

              if (matrixValue.mark === "-" || matrixValue.mark === "") {
                this.setValueAt(
                  2 + fileBaseRow + contentRow,
                  2 + fileBaseCol + contentCol,
                  matrixValue.mark,
                );
                this.setOnClickCloseImpactScopeDisplayMode(
                  2 + fileBaseRow + contentRow,
                  2 + fileBaseCol + contentCol,
                );
              } else {
                this.setContentValueAt(
                  2 + fileBaseRow + contentRow,
                  2 + fileBaseCol + contentCol,
                  matrixValue.mark,
                  `${matrixValue.description} ※ ダブルクリックで編集`,
                );

                this.setContentOnClick(
                  2 + fileBaseRow + contentRow,
                  2 + fileBaseCol + contentCol,
                  heCol.matrixKey(),
                );
              }

              if (
                this.tablePageInfo.impactScopeDisplayMode &&
                matrixValue.shouldPaintSelf
              ) {
                this.paintAt(
                  2 + fileBaseRow + contentRow,
                  2 + fileBaseCol + contentCol,
                );
              }

              if (this.dblClickedData === undefined) {
                this
                  .table[2 + fileBaseRow + contentRow][
                    2 + fileBaseCol + contentCol
                  ].setOnDblClick(
                    ((
                      updateDblClickedData: Dispatch<
                        SetStateAction<DblClickedData | undefined>
                      >,
                      mark: string,
                      key: string,
                      description: string,
                      heRowKey: string,
                      heColKey: string,
                    ) => {
                      return () => {
                        updateDblClickedData({
                          id: key,
                          mark: (mark === "" || mark === "-") ? "-" : "〇",
                          description: description,
                          key_row: heRowKey,
                          key_col: heColKey,
                        });
                      };
                    })(
                      this.updateDblClickedData,
                      matrixValue.mark,
                      this.getKeyAt(
                        2 + fileBaseRow + contentRow,
                        2 + fileBaseCol + contentCol,
                      ),
                      matrixValue.description,
                      heRow.matrixKey(),
                      heCol.matrixKey(),
                    ),
                  );
              }

              contentCol += 1;
            }
            contentCol = 0;
            contentRow += 1;
          }
        } else if (
          this.tablePageInfo.headerInfo.get(fileNameRow)!.isRowOpen &&
          !this.tablePageInfo.headerInfo.get(fileNameCol)!.isColOpen
        ) {
          // fileName の col が閉じているとき

          for (
            const heRow of this.tablePageInfo.headerInfo.get(fileNameRow)!
              .headerElements
          ) {
            let combinedMark = "-";
            let combinedShouldPaint = false; // 塗るべきかどうか
            for (
              const heCol of this.tablePageInfo.headerInfo.get(fileNameCol)!
                .headerElements
            ) {
              const matrixValue = this.tablePageInfo.matrix.getMatrixValue(
                heRow.matrixKey(),
                heCol.matrixKey(),
              );
              if (
                matrixValue.mark === "〇"
              ) {
                combinedMark = "〇";
              }

              // 塗るべきかどうか
              combinedShouldPaint ||= matrixValue.shouldPaintSelf;
            }

            this.setValueAt(
              2 + fileBaseRow + contentRow,
              2 + fileBaseCol + contentCol,
              combinedMark,
            );

            if (
              this.tablePageInfo.impactScopeDisplayMode && combinedShouldPaint
            ) {
              this.paintAt(
                2 + fileBaseRow + contentRow,
                2 + fileBaseCol + contentCol,
              );
            }

            contentRow += 1;
          }

          contentCol += 1;
        } else if (
          !this.tablePageInfo.headerInfo.get(fileNameRow)!.isRowOpen &&
          this.tablePageInfo.headerInfo.get(fileNameCol)!.isColOpen
        ) {
          // row が閉じているとき
          for (
            const heCol of this.tablePageInfo.headerInfo.get(fileNameCol)!
              .headerElements
          ) {
            let combinedMark = "-";
            let combinedShouldPaint = false; // 塗るべきかどうか
            for (
              const heRow of this.tablePageInfo.headerInfo.get(fileNameRow)!
                .headerElements
            ) {
              const matrixValue = this.tablePageInfo.matrix.getMatrixValue(
                heRow.matrixKey(),
                heCol.matrixKey(),
              );

              if (
                matrixValue.mark === "〇"
              ) {
                combinedMark = "〇";
              }

              combinedShouldPaint ||= matrixValue.shouldPaintSelf;
            }
            this.setValueAt(
              2 + fileBaseRow + contentRow,
              2 + fileBaseCol + contentCol,
              combinedMark,
            );

            // 塗るべきかどうか判断
            if (
              this.tablePageInfo.impactScopeDisplayMode && combinedShouldPaint
            ) {
              this.paintAt(
                2 + fileBaseRow + contentRow,
                2 + fileBaseCol + contentCol,
              );
            }

            contentCol += 1;
          }
          contentRow += 1;
        } else {
          let combinedMark = "-";
          let combinedShouldPaint = false;

          for (
            const heRow of this.tablePageInfo.headerInfo.get(fileNameCol)!
              .headerElements
          ) {
            for (
              const heCol of this.tablePageInfo.headerInfo.get(fileNameCol)!
                .headerElements
            ) {
              const matrixValue = this.tablePageInfo.matrix.getMatrixValue(
                heRow.matrixKey(),
                heCol.matrixKey(),
              );

              if (
                matrixValue.mark === "〇"
              ) {
                combinedMark = "〇";
              }

              combinedShouldPaint ||= matrixValue.shouldPaintSelf;
            }
          }

          this.setValueAt(
            2 + fileBaseRow + contentRow,
            2 + fileBaseCol + contentCol,
            combinedMark,
          );

          // 塗るべきかどうか判断
          if (
            this.tablePageInfo.impactScopeDisplayMode && combinedShouldPaint
          ) {
            this.paintAt(
              2 + fileBaseRow + contentRow,
              2 + fileBaseCol + contentCol,
            );
          }

          contentRow += 1;
          contentCol += 1;
        }

        if (this.tablePageInfo.headerInfo.get(fileNameCol)!.isColOpen) {
          fileBaseCol +=
            this.tablePageInfo.headerInfo.get(fileNameCol)!.headerElements
              .length;
        } else {
          fileBaseCol += 1;
        }
      }

      fileBaseCol = 0;

      if (this.tablePageInfo.headerInfo.get(fileNameRow)!.isRowOpen) {
        fileBaseRow +=
          this.tablePageInfo.headerInfo.get(fileNameRow)!.headerElements.length;
      } else {
        fileBaseRow += 1;
      }
    }

    // <thead> の中身を作る
    const theadRows: JSX.Element[] = [];

    // 1 行目と 2 行目は <thead> に入れる
    for (let i = 0; i < 2; i++) {
      const thCols = [];
      for (const j in this.table[i]) {
        if (this.table[i][j].getIsActive()) {
          thCols.push(this.table[i][j].asJsx());
        }
      }
      theadRows.push(<tr key={`row_${i}`}>{thCols}</tr>);
    }

    const tbodyRows: JSX.Element[] = [];
    // 2 行目以降は <tbody> に入れる
    for (let i = 2; i < this.table.length; i++) {
      const tbodyCols: JSX.Element[] = [];
      for (const j in this.table[i]) {
        if (this.table[i][j].getIsActive()) {
          tbodyCols.push(this.table[i][j].asJsx());
        }
      }
      tbodyRows.push(<tr key={`row_${i}`}>{tbodyCols}</tr>);
    }

    // Tooltip
    let tooltip: JSX.Element;
    if (this.dblClickedData === undefined) {
      tooltip = <Tooltip id={"td-tooltip"} />;
    } else {
      tooltip = (() => {
        return (
          <MyTooltip
            id={this.dblClickedData.id}
            initDescription={this.dblClickedData.description}
            initMark={this.dblClickedData.mark}
            cancelHandler={() => {
              this.updateDblClickedData(undefined);
            }}
            dataSetHandler={(description: string, mark: string) => {
              this.tablePageInfo.matrix.getMatrixValue(
                this.dblClickedData!.key_row,
                this.dblClickedData!.key_col,
              ).mark = mark;
              this.tablePageInfo.matrix.getMatrixValue(
                this.dblClickedData!.key_row,
                this.dblClickedData!.key_col,
              ).description = description;
              this.update({ ...this.tablePageInfo });

              this.updateDblClickedData(undefined);
            }}
          />
        );
      })();
    }

    return (
      <div>
        <table>
          <thead>
            {theadRows}
          </thead>
          <tbody>
            {tbodyRows}
          </tbody>
        </table>
        {tooltip}
      </div>
    );
  }
}

// matrix["x.list:1"]["y.list:1"] = 'o' みたいな....
type MatrixValue = {
  mark: string;
  description: string;
  shouldPaintSelf: boolean;
};
class Matrix {
  clearImpactScope() {
    for (const rowKey in this.matrix) {
      for (const colKey in this.matrix[rowKey]) {
        this.matrix[rowKey][colKey].shouldPaintSelf = false;
      }
    }
  }
  matrix: { [rowKey: string]: { [columnKey: string]: MatrixValue } };

  constructor() {
    this.matrix = {};
  }

  register_arrow(
    fileNameFrom: string,
    idFrom: string,
    fileNameTo: string,
    idTo: string,
    description: string,
    mark: string,
  ) {
    if (!this.matrix[`${fileNameFrom}:${idFrom}`]) {
      this.matrix[`${fileNameFrom}:${idFrom}`] = {};
    }

    if (
      !this.matrix[`${fileNameFrom}:${idFrom}`][`${fileNameTo}:${idTo}`]
    ) {
      this.matrix[`${fileNameFrom}:${idFrom}`][`${fileNameTo}:${idTo}`] = {
        mark: "",
        description: "",
        shouldPaintSelf: false,
      };
    }

    this.matrix[`${fileNameFrom}:${idFrom}`][`${fileNameTo}:${idTo}`].mark =
      mark;
    this.matrix[`${fileNameFrom}:${idFrom}`][`${fileNameTo}:${idTo}`]
      .description = description;
  }

  getMatrixValue(
    key_from: string,
    key_to: string,
  ): MatrixValue {
    if (!this.matrix[key_from]) {
      this.matrix[key_from] = {};
    }

    if (!this.matrix[key_from][key_to]) {
      this.matrix[key_from][key_to] = {
        mark: "-",
        description: "",
        shouldPaintSelf: false,
      };
    }

    return this.matrix[key_from][key_to];
  }

  calcurateImpactScope(startNodeKey: string) {
    const visited: { [key: string]: boolean } = {};
    const reversedMatrix: { [rowKey: string]: { [colKey: string]: boolean } } =
      {}; // true だったら線あり

    for (const rowKey in this.matrix) {
      for (const colKey in this.matrix[rowKey]) {
        if (this.matrix[rowKey][colKey].mark === "〇") {
          if (reversedMatrix[colKey] === undefined) {
            reversedMatrix[colKey] = {};
          }
          reversedMatrix[colKey][rowKey] = true;
          visited[rowKey] = false;
          visited[colKey] = false;
        }
      }
    }

    const stack: string[] = [startNodeKey];

    while (stack.length !== 0) {
      const fromNodeKey: string = stack.pop()!;
      visited[fromNodeKey] = true;
      for (const toNodeKey in reversedMatrix[fromNodeKey]) {
        this.matrix[toNodeKey][fromNodeKey].shouldPaintSelf = true;
        if (!visited[toNodeKey]) {
          stack.push(toNodeKey);
        }
      }
    }
  }
}

export type HeaderInfo = Map<
  string,
  { headerElements: HeaderElement[]; isRowOpen: boolean; isColOpen: boolean }
>;

// 読み込んだテーブルファイルの情報
export class TablePageInfo {
  matrix: Matrix; // ヘッダーを含まない行列の値
  headerInfo: HeaderInfo;
  tableFilePath: string;
  impactScopeDisplayMode: boolean;
  clickedPosition: ClickedPosition;

  static empty(): TablePageInfo {
    return new TablePageInfo(
      new Matrix(),
      new Map(),
      "",
      false,
    );
  }

  constructor(
    matrix: Matrix,
    headerInfo: HeaderInfo,
    tableFilePath: string,
    impactScopeDisplayMode: boolean,
  ) {
    this.matrix = matrix;
    this.headerInfo = headerInfo;
    this.tableFilePath = tableFilePath;
    this.impactScopeDisplayMode = impactScopeDisplayMode;
    this.clickedPosition = { row: -1, col: -1 };
  }
}

enum ReadState {
  SkipInitialLine,
  ReadFileName,
  ReadArrow,
}

interface DblClickedData {
  id: string;
  mark: string;
  description: string;
  key_row: string;
  key_col: string;
}

interface TablePageProp {
  path: string;
}

export const TablePage: FC<TablePageProp> = ({ path }) => {
  /* 状態管理 */
  const [tablePageInfo, setTablePageInfo] = useState<TablePageInfo>(
    TablePageInfo.empty(),
  );
  const [dblClickedData, setDblClickedData] = useState<
    DblClickedData | undefined
  >(undefined);

  // 変更ハンドラーを定義します

  const hasRun = useRef(false);
  const initialize = async () => {
    const matrixTmp: Matrix = new Matrix();
    const headerInfo: HeaderInfo = new Map();

    const text = await readTextFile(path);

    // path を保存しておく
    const readTableFilePath = path;

    // 先頭のコメントを読み込むが
    // 1 行目は飛ばす
    let readState: ReadState = ReadState.SkipInitialLine;
    const splited = text.split("\n").map((line) => line.trim());
    let lineNum = 0; // 現在読んでいる行数

    // 現在読んでいる行数が "\n" で分けた行数より大きくなったら終わり
    while (lineNum < splited.length) {
      const line = splited[lineNum];

      if (readState === ReadState.SkipInitialLine) {
        readState = ReadState.ReadFileName;
        lineNum += 1;
      } else if (readState === ReadState.ReadFileName) {
        if (line.startsWith("'")) {
          const fileName = line.slice(1).trim(); // 1 文字目以降を取得
          const dirName = await getDir(path);
          const filePath = await joinPath(dirName, fileName);

          const listText = await readTextFile(filePath);

          headerInfo.set(fileName, {
            headerElements: extractHeaderElement(fileName, listText),
            isRowOpen: true,
            isColOpen: true,
          });

          lineNum += 1;
        } else {
          readState = ReadState.ReadArrow;
        }
      } else if (readState === ReadState.ReadArrow) {
        if (line.includes("-->") || line.includes("<--")) {
          const splitedWithSpace = line.split(" ");

          const [fileNameLeft, idLeft] = splitedWithSpace[0].split(":");
          const [fileNameRight, idRight] = splitedWithSpace[2].split(
            ":",
          );

          let description;
          // コメントの抽出(簡易版)
          if (line.includes("'")) {
            description = line.slice(line.lastIndexOf("'")).slice(1).trim();
          } else {
            description = "";
          }

          if (splitedWithSpace[1] === "-->") {
            matrixTmp.register_arrow(
              fileNameLeft,
              idLeft,
              fileNameRight,
              idRight,
              description,
              "〇",
            );
          } else if (splitedWithSpace[1] === "<--") {
            matrixTmp.register_arrow(
              fileNameRight,
              idRight,
              fileNameLeft,
              idLeft,
              description,
              "〇",
            );
          }
        }

        lineNum += 1;
      }
    }

    setTablePageInfo(
      new TablePageInfo(matrixTmp, headerInfo, readTableFilePath, false),
    );
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
      <p className="block my-1 text-sm font-medium text-gray-900 dark:text-white">
        {path}
      </p>
      <ListFileChooser
        initialFilePathes={Array.from(tablePageInfo.headerInfo.keys())}
        setTablePageInfo={setTablePageInfo}
        oldFileNames={Array.from(tablePageInfo.headerInfo.keys())}
        path={path}
        tablePageInfoNow={tablePageInfo}
      />
      {new Table(
        tablePageInfo,
        dblClickedData,
        setTablePageInfo,
        setDblClickedData,
      ).asJsx()}
      <button
        onClick={async () => {
          await writeToTableFile(tablePageInfo);
        }}
      >
        保存
      </button>
    </div>
  );
};
