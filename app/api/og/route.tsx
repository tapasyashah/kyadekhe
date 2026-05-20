import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          background: '#0D0D0D',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Warm glow behind the poster collage */}
        <div
          style={{
            position: 'absolute',
            right: '-60px',
            top: '-60px',
            width: '600px',
            height: '600px',
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,153,0,0.18) 0%, rgba(255,50,50,0.08) 50%, transparent 75%)',
          }}
        />

        {/* Abstract poster frames — right side */}
        {/* Back frame */}
        <div
          style={{
            position: 'absolute',
            right: '60px',
            top: '60px',
            width: '220px',
            height: '330px',
            borderRadius: '12px',
            background: 'linear-gradient(145deg, #1a3a4a 0%, #0a2030 100%)',
            border: '2px solid rgba(255,153,0,0.3)',
            transform: 'rotate(6deg)',
          }}
        />
        {/* Mid frame */}
        <div
          style={{
            position: 'absolute',
            right: '140px',
            top: '80px',
            width: '220px',
            height: '330px',
            borderRadius: '12px',
            background: 'linear-gradient(145deg, #4a1520 0%, #2a0a10 100%)',
            border: '2px solid rgba(255,80,80,0.3)',
            transform: 'rotate(-3deg)',
          }}
        />
        {/* Front frame */}
        <div
          style={{
            position: 'absolute',
            right: '200px',
            top: '100px',
            width: '220px',
            height: '330px',
            borderRadius: '12px',
            background: 'linear-gradient(145deg, #3a3010 0%, #1a1500 100%)',
            border: '2px solid rgba(255,200,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: '64px' }}>🎬</div>
        </div>

        {/* Left content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 80px',
            height: '100%',
            maxWidth: '620px',
          }}
        >
          {/* Eyebrow */}
          <div
            style={{
              fontSize: '16px',
              color: 'rgba(255,153,0,0.7)',
              letterSpacing: '4px',
              textTransform: 'uppercase',
              marginBottom: '20px',
              fontFamily: 'sans-serif',
            }}
          >
            Bollywood Discovery
          </div>

          {/* Wordmark */}
          <div
            style={{
              fontSize: '96px',
              fontWeight: '700',
              color: '#FF9900',
              lineHeight: 1,
              marginBottom: '24px',
              fontFamily: 'serif',
              letterSpacing: '-2px',
            }}
          >
            KyaDekhe
          </div>

          {/* Hindi subtitle */}
          <div
            style={{
              fontSize: '22px',
              color: 'rgba(255,255,255,0.5)',
              marginBottom: '32px',
              fontFamily: 'sans-serif',
            }}
          >
            क्या देखें
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: '28px',
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.5,
              fontFamily: 'sans-serif',
            }}
          >
            Swipe through Bollywood.
            <br />
            Get picks that match your taste.
          </div>

          {/* Divider */}
          <div
            style={{
              width: '60px',
              height: '3px',
              background: '#FF9900',
              marginTop: '40px',
              borderRadius: '2px',
            }}
          />
        </div>

        {/* Bottom film strip decoration */}
        <div
          style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            height: '4px',
            background: 'linear-gradient(90deg, transparent, #FF9900, #FF5050, #FF9900, transparent)',
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
