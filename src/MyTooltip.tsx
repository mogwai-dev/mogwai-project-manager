import { useState } from "react";
import { Tooltip } from "react-tooltip";

interface MyTooltipProp {
  id: string;
  initDescription: string;
  initMark: string;
  cancelHandler: () => void;
  dataSetHandler: (description: string, mark: string) => void;
}

const MyTooltip: React.FC<MyTooltipProp> = (
  { id, initDescription, initMark, cancelHandler, dataSetHandler },
) => {
  const [description, setDescription] = useState<string>(initDescription);
  const [mark, setMark] = useState<string>(initMark);

  const descriptionOnChange = (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setDescription(e.target.value);
  };

  const markOnChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
  ) => {
    setMark(e.target.value);
  };

  return (
    <Tooltip id={id} isOpen={true} clickable={true}>

      {/* 選択 */}

      <label
        htmlFor="line_selection"
        className="block text-sm font-light text-white dark:text-white"
      >
        影響状態
      </label>
      <select
        id="line_selection"
        className="bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        defaultValue={mark}
        onChange={markOnChange}
      >
        <option value="〇">〇</option>
        <option value="-">-</option>
      </select>

      {/* 説明 */}

      <label
        htmlFor="description-input"
        className="block text-sm font-light text-white dark:text-white"
      >
        説明
      </label>
      <input
        type="text"
        id="description-input"
        className="block w-full text-gray-900 border border-gray-300 rounded-lg bg-gray-50 text-xs focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
        defaultValue={description}
        onChange={descriptionOnChange}
      />

      <div className="mt-2 inline-flex justify-center">
        <button
          onClick={() => {
            cancelHandler(); // ツールチップを戻す
          }}
          className="px-1 py-1 text-xs text-white border border-gray-300 rounded-md"
        >
          破棄して閉じる
        </button>
        <button
          onClick={() => {
            cancelHandler(); // ツールチップを戻す
            dataSetHandler(description, mark);
          }}
          className="px-1 py-1 text-xs text-white border border-gray-300 rounded-md"
        >
          保存して閉じる
        </button>
      </div>
    </Tooltip>
  );
};

export default MyTooltip;
