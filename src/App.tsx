import { useState, useRef, useCallback, useEffect } from 'react'
import { Button } from './components/ui/button'
import { Card } from './components/ui/card'
import { Badge } from './components/ui/badge'
import { RotateCcw, Trophy, Clock, HelpCircle, Smartphone } from 'lucide-react'

interface Coin {
  id: number
  x: number
  y: number
  isSelected: boolean
}

interface Position {
  x: number
  y: number
}

// Responsive coin size - larger on mobile
const COIN_RADIUS = window.innerWidth < 768 ? 35 : 30
const BOARD_WIDTH = Math.min(600, window.innerWidth - 32)
const BOARD_HEIGHT = Math.min(400, window.innerHeight * 0.5)

// Responsive positions based on board size
const centerX = BOARD_WIDTH / 2
const centerY = BOARD_HEIGHT / 2

// Initial triangle formation (upward triangle) - coins touching each other
const INITIAL_POSITIONS: Position[] = [
  { x: centerX, y: centerY - 60 }, // Top coin
  { x: centerX - 30, y: centerY - 8 }, // Middle left (touching top)
  { x: centerX + 30, y: centerY - 8 }, // Middle right (touching top)
  { x: centerX - 60, y: centerY + 44 }, // Bottom left (touching middle left)
  { x: centerX, y: centerY + 44 }, // Bottom center (touching both middle coins)
  { x: centerX + 60, y: centerY + 44 }, // Bottom right (touching middle right)
]

// Target formation (downward triangle) - coins touching each other
const TARGET_POSITIONS: Position[] = [
  { x: centerX - 60, y: centerY - 60 }, // Top left
  { x: centerX, y: centerY - 60 }, // Top center (touching top left)
  { x: centerX + 60, y: centerY - 60 }, // Top right (touching top center)
  { x: centerX - 30, y: centerY - 8 }, // Middle left (touching top left and center)
  { x: centerX + 30, y: centerY - 8 }, // Middle right (touching top center and right)
  { x: centerX, y: centerY + 44 }, // Bottom center (touching both middle coins)
]

function App() {
  const [coins, setCoins] = useState<Coin[]>(() =>
    INITIAL_POSITIONS.map((pos, index) => ({
      id: index,
      x: pos.x,
      y: pos.y,
      isSelected: false,
    }))
  )
  const [moves, setMoves] = useState(0)
  const [bestScore, setBestScore] = useState<number | null>(() => {
    const saved = localStorage.getItem('coinPuzzleBestScore')
    return saved ? parseInt(saved) : null
  })
  const [isComplete, setIsComplete] = useState(false)
  const [startTime, setStartTime] = useState<number>(Date.now())
  const [elapsedTime, setElapsedTime] = useState(0)
  const [showInstructions, setShowInstructions] = useState(false)
  const [selectedCoin, setSelectedCoin] = useState<number | null>(null)
  const [validDropZones, setValidDropZones] = useState<Position[]>([])

  const svgRef = useRef<SVGSVGElement>(null)

  // Timer effect
  useEffect(() => {
    if (isComplete) return
    
    const interval = setInterval(() => {
      setElapsedTime(Date.now() - startTime)
    }, 100)

    return () => clearInterval(interval)
  }, [startTime, isComplete])

  // Check if puzzle is complete
  useEffect(() => {
    const isCompleted = coins.every((coin, index) => {
      const target = TARGET_POSITIONS[index]
      const distance = Math.sqrt(
        Math.pow(coin.x - target.x, 2) + Math.pow(coin.y - target.y, 2)
      )
      return distance < 20 // Allow some tolerance
    })

    if (isCompleted && !isComplete) {
      setIsComplete(true)
      if (!bestScore || moves < bestScore) {
        setBestScore(moves)
        localStorage.setItem('coinPuzzleBestScore', moves.toString())
      }
    }
  }, [coins, moves, bestScore, isComplete])

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${(seconds % 60).toString().padStart(2, '0')}`
  }

  const getDistance = (pos1: Position, pos2: Position) => {
    return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2))
  }

  const findValidDropZones = useCallback((coinId: number) => {
    const currentCoin = coins.find(c => c.id === coinId)
    if (!currentCoin) return []

    const otherCoins = coins.filter(c => c.id !== coinId)
    const validZones: Position[] = []

    // For each pair of other coins, find positions where the selected coin would touch both
    for (let i = 0; i < otherCoins.length; i++) {
      for (let j = i + 1; j < otherCoins.length; j++) {
        const coin1 = otherCoins[i]
        const coin2 = otherCoins[j]
        
        const distance = getDistance(coin1, coin2)
        if (distance <= COIN_RADIUS * 4) { // Only if coins are close enough
          // Calculate the two possible positions where a coin can touch both
          const midX = (coin1.x + coin2.x) / 2
          const midY = (coin1.y + coin2.y) / 2
          
          const dx = coin2.x - coin1.x
          const dy = coin2.y - coin1.y
          const dist = Math.sqrt(dx * dx + dy * dy)
          
          if (dist > 0) {
            const perpX = -dy / dist
            const perpY = dx / dist
            
            const offset = Math.sqrt(Math.max(0, (COIN_RADIUS * 2) * (COIN_RADIUS * 2) - (dist / 2) * (dist / 2)))
            
            const pos1 = { x: midX + perpX * offset, y: midY + perpY * offset }
            const pos2 = { x: midX - perpX * offset, y: midY - perpY * offset }
            
            // Check if positions are within bounds and not occupied
            if (pos1.x > COIN_RADIUS && pos1.x < BOARD_WIDTH - COIN_RADIUS &&
                pos1.y > COIN_RADIUS && pos1.y < BOARD_HEIGHT - COIN_RADIUS) {
              const occupied = otherCoins.some(c => getDistance(c, pos1) < COIN_RADIUS * 1.5)
              if (!occupied) validZones.push(pos1)
            }
            
            if (pos2.x > COIN_RADIUS && pos2.x < BOARD_WIDTH - COIN_RADIUS &&
                pos2.y > COIN_RADIUS && pos2.y < BOARD_HEIGHT - COIN_RADIUS) {
              const occupied = otherCoins.some(c => getDistance(c, pos2) < COIN_RADIUS * 1.5)
              if (!occupied) validZones.push(pos2)
            }
          }
        }
      }
    }

    return validZones
  }, [coins])

  // Touch-friendly coin selection
  const handleCoinClick = useCallback((coinId: number) => {
    if (selectedCoin === coinId) {
      // Deselect if clicking the same coin
      setSelectedCoin(null)
      setValidDropZones([])
      setCoins(prev => prev.map(coin => ({ ...coin, isSelected: false })))
    } else {
      // Select new coin and show valid drop zones
      setSelectedCoin(coinId)
      setValidDropZones(findValidDropZones(coinId))
      setCoins(prev => prev.map(coin => ({
        ...coin,
        isSelected: coin.id === coinId
      })))
    }
  }, [selectedCoin, findValidDropZones])

  // Touch-friendly zone placement
  const handleZoneClick = useCallback((zone: Position) => {
    if (selectedCoin === null) return

    // Move selected coin to the clicked zone
    setCoins(prev => prev.map(coin => 
      coin.id === selectedCoin 
        ? { ...coin, x: zone.x, y: zone.y, isSelected: false }
        : { ...coin, isSelected: false }
    ))
    
    setMoves(prev => prev + 1)
    setSelectedCoin(null)
    setValidDropZones([])
  }, [selectedCoin])

  const resetGame = () => {
    setCoins(INITIAL_POSITIONS.map((pos, index) => ({
      id: index,
      x: pos.x,
      y: pos.y,
      isSelected: false,
    })))
    setMoves(0)
    setIsComplete(false)
    setStartTime(Date.now())
    setElapsedTime(0)
    setSelectedCoin(null)
    setValidDropZones([])
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Smartphone className="w-6 h-6 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold text-primary">
              Russian Coin Triangle Puzzle
            </h1>
          </div>
          <p className="text-muted-foreground text-base md:text-lg">
            Tap to select coins, then tap valid zones to move
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Optimized for touch devices • Works great on iOS
          </p>
        </div>

        {/* Stats Bar */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">Moves:</span>
              <Badge variant="secondary" className="text-lg font-bold">
                {moves}
              </Badge>
            </div>
          </Card>
          
          <Card className="px-4 py-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">Time:</span>
              <Badge variant="outline" className="font-mono">
                {formatTime(elapsedTime)}
              </Badge>
            </div>
          </Card>

          {bestScore && (
            <Card className="px-4 py-2">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Best:</span>
                <Badge variant="default" className="text-primary-foreground">
                  {bestScore}
                </Badge>
              </div>
            </Card>
          )}
        </div>

        {/* Game Board */}
        <Card className="p-4 md:p-6 mb-6">
          <div className="relative">
            {selectedCoin !== null && (
              <div className="text-center mb-4 p-3 bg-primary/10 rounded-lg border border-primary/20">
                <p className="text-sm font-medium text-primary">
                  Coin {selectedCoin + 1} selected • Tap a glowing zone to move it
                </p>
              </div>
            )}
            
            <svg
              ref={svgRef}
              width={BOARD_WIDTH}
              height={BOARD_HEIGHT}
              className="border border-border rounded-lg bg-card mx-auto block touch-manipulation"
              style={{ touchAction: 'manipulation' }}
            >
              {/* Valid drop zones - clickable for touch */}
              {validDropZones.map((zone, index) => (
                <g key={`zone-${index}`}>
                  <circle
                    cx={zone.x}
                    cy={zone.y}
                    r={COIN_RADIUS + 8}
                    fill="hsl(var(--primary))"
                    opacity="0.2"
                    className="cursor-pointer hover:opacity-30 transition-opacity"
                    onClick={() => handleZoneClick(zone)}
                  />
                  <circle
                    cx={zone.x}
                    cy={zone.y}
                    r={COIN_RADIUS + 5}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="3"
                    strokeDasharray="8,4"
                    opacity="0.8"
                    className="pointer-events-none animate-pulse"
                  />
                </g>
              ))}

              {/* Target positions (faint outline) */}
              {!isComplete && TARGET_POSITIONS.map((pos, index) => (
                <circle
                  key={`target-${index}`}
                  cx={pos.x}
                  cy={pos.y}
                  r={COIN_RADIUS}
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="1"
                  strokeDasharray="3,3"
                  opacity="0.3"
                />
              ))}

              {/* Coins - clickable for touch */}
              {coins.map((coin) => (
                <g key={coin.id}>
                  <circle
                    cx={coin.x}
                    cy={coin.y}
                    r={COIN_RADIUS + (coin.isSelected ? 5 : 0)}
                    fill={coin.isSelected ? "hsl(var(--primary))" : "hsl(var(--secondary))"}
                    stroke={coin.isSelected ? "hsl(var(--secondary))" : "hsl(var(--primary))"}
                    strokeWidth={coin.isSelected ? "4" : "3"}
                    className={`transition-all duration-300 cursor-pointer hover:brightness-110 ${
                      coin.isSelected ? 'animate-pulse' : ''
                    }`}
                    onClick={() => handleCoinClick(coin.id)}
                  />
                  <text
                    x={coin.x}
                    y={coin.y + 5}
                    textAnchor="middle"
                    className={`font-bold fill-primary-foreground pointer-events-none select-none ${
                      coin.isSelected ? 'text-base' : 'text-sm'
                    }`}
                  >
                    {coin.id + 1}
                  </text>
                </g>
              ))}
            </svg>
          </div>
        </Card>

        {/* Success Message */}
        {isComplete && (
          <Card className="p-6 mb-6 border-primary bg-primary/10">
            <div className="text-center">
              <Trophy className="w-12 h-12 text-primary mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-primary mb-2">
                Congratulations! 🎉
              </h2>
              <p className="text-lg mb-4">
                You solved the puzzle in <strong>{moves}</strong> moves and{' '}
                <strong>{formatTime(elapsedTime)}</strong>!
              </p>
              {bestScore === moves && (
                <Badge variant="default" className="mb-4">
                  New Best Score! 🏆
                </Badge>
              )}
            </div>
          </Card>
        )}

        {/* Controls */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <Button onClick={resetGame} variant="outline" size="lg">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset Game
          </Button>
          
          <Button 
            onClick={() => setShowInstructions(!showInstructions)} 
            variant="secondary" 
            size="lg"
          >
            <HelpCircle className="w-4 h-4 mr-2" />
            Instructions
          </Button>
        </div>

        {/* Instructions */}
        {showInstructions && (
          <Card className="p-6">
            <h3 className="text-xl font-bold mb-4">How to Play</h3>
            <div className="space-y-3 text-sm">
              <p>
                <strong>Goal:</strong> Rearrange the 6 coins to flip the triangle from pointing up to pointing down.
              </p>
              <p>
                <strong>Rules:</strong> Each move must result in the coin touching exactly two other coins.
              </p>
              <p>
                <strong>Touch Controls:</strong> 
                <br />• Tap a coin to select it (it will glow and pulse)
                <br />• Valid drop zones will appear as glowing circles
                <br />• Tap any glowing zone to move the selected coin there
                <br />• Tap the same coin again to deselect it
              </p>
              <p>
                <strong>Challenge:</strong> Try to solve it in the fewest moves possible! The theoretical minimum is 3 moves.
              </p>
              <p className="text-muted-foreground">
                <strong>iOS Tip:</strong> This game works perfectly on iPhone and iPad with native touch controls. No drag & drop needed!
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}

export default App