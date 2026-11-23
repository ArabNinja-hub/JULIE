import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

/**
 * The lunar sun sits low and never moves — but its shadow frustum must
 * follow the explorer, otherwise the dramatic long shadows disappear as
 * soon as she walks away from the origin. This rig slides the light (and
 * its target) along with the camera, keeping shadow resolution tight.
 */
export default function LightRig({ isMobile }) {
  const light = useRef()
  const target = useRef()
  const { scene } = useThree()

  useEffect(() => {
    if (light.current && target.current) {
      light.current.target = target.current
      scene.add(target.current)
    }
    return () => {
      if (target.current) scene.remove(target.current)
    }
  }, [scene])

  useFrame(({ camera }) => {
    if (!light.current || !target.current) return
    target.current.position.set(camera.position.x, 0, camera.position.z)
    target.current.updateMatrixWorld()
    light.current.position.set(
      camera.position.x + 130,
      100,
      camera.position.z + 70
    )
  })

  const size = isMobile ? 1024 : 2048

  return (
    <>
      <directionalLight
        ref={light}
        intensity={2.7}
        color="#eef2ff"
        castShadow
        shadow-mapSize-width={size}
        shadow-mapSize-height={size}
        shadow-camera-left={-120}
        shadow-camera-right={120}
        shadow-camera-top={120}
        shadow-camera-bottom={-120}
        shadow-camera-near={1}
        shadow-camera-far={460}
        shadow-bias={-0.0008}
        shadow-normalBias={0.08}
      />
      <object3D ref={target} position={[0, 0, 0]} />
    </>
  )
}
