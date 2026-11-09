export type AppBoot = {
  message: string;
  version: string;
  podName: string;
};

type AppProps = {
  boot?: AppBoot;
};

export function App({ boot }: AppProps) {
  const data = boot ?? window.__BOOT__;

  if (!data) {
    return <main><p>Waiting for the server connection...</p></main>;
  }

  return (
    <main>
      <p className="eyebrow">EX.CO</p>
      <h1 id="message">{data.message}</h1>
      <p id="version">Version: {data.version}</p>
      <p id="pod">Pod: {data.podName}</p>
      <p id="timestamp">Timestamp: {data.timestamp}</p>
    </main>
  );
}
