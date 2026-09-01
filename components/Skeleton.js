export function SkeletonStatRow({ count = 3 }) {
  return (
    <div className="stat-row">
      {Array.from({ length: count }).map((_, i) => (
        <div className="stat-cell" key={i} style={{ animationDelay: `${i * 0.05}s` }}>
          <div className="skel" style={{ width: 70, height: 10, marginBottom: 10 }}></div>
          <div className="skel" style={{ width: 60, height: 24 }}></div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonTableRows({ cols = 4, rows = 5 }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c}>
              <div className="skel" style={{ height: 14, width: c === 0 ? "70%" : "50%" }}></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
