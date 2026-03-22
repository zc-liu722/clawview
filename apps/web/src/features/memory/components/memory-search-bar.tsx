interface MemorySearchBarProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export function MemorySearchBar({ query, onQueryChange }: MemorySearchBarProps) {
  return (
    <label className="memory-search-bar">
      <span aria-hidden="true">⌕</span>
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="搜索记忆内容"
      />
      {query ? (
        <button type="button" onClick={() => onQueryChange("")}>
          清除
        </button>
      ) : null}
    </label>
  );
}
