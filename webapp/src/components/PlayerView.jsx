import VideoPlayer from './VideoPlayer.jsx'

export default function PlayerView({ video, watchStore, onExit }) {
  return (
    <div className="player-view">
      <VideoPlayer video={video} watchStore={watchStore} onExit={onExit} />
    </div>
  )
}
