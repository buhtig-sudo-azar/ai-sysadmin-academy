import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, context, mode } = body

    // Simulate AI mentor response based on mode
    let response = ''

    if (mode === 'interview') {
      response = generateInterviewResponse(message, context)
    } else if (mode === 'explain') {
      response = generateExplanationResponse(message, context)
    } else {
      response = generateMentorResponse(message, context)
    }

    return NextResponse.json({ response })
  } catch (error) {
    console.error('AI Mentor error:', error)
    return NextResponse.json({ error: 'AI Mentor error' }, { status: 500 })
  }
}

function generateMentorResponse(message: string, context?: string): string {
  const lowerMsg = message.toLowerCase()

  if (lowerMsg.includes('linux') && lowerMsg.includes('boot')) {
    return `Great question about the Linux boot process! Let me break it down:\n\n**The boot sequence:**\n1. **BIOS/UEFI POST** - Hardware check\n2. **GRUB2** - Boot loader loads kernel + initramfs\n3. **Kernel init** - Detects hardware, loads drivers\n4. **systemd (PID 1)** - First userspace process\n5. **Targets** - Reaches default.target\n\n**Key tip for interviews:** Mention that systemd replaced SysVinit and uses parallel service startup, which significantly speeds up boot time.\n\nWant me to go deeper into any specific stage?`
  }

  if (lowerMsg.includes('docker') && (lowerMsg.includes('network') || lowerMsg.includes('bridge'))) {
    return `Docker networking is a crucial topic! Here is what you need to know:\n\n**Main network drivers:**\n- **bridge** (default) - Private network with port mapping\n- **host** - Shares host network stack (best performance)\n- **overlay** - Multi-host networking for Swarm\n- **macvlan** - Container gets real MAC on LAN\n\n**Pro tip:** Always create a custom bridge network for multi-container apps. This gives you automatic DNS resolution between containers, which the default bridge does NOT provide.\n\n\`\`\`bash\ndocker network create myapp-net\ndocker run --network myapp-net --name api myimage\ndocker run --network myapp-net --name db myimage\n# api can reach db via hostname \"db\"\n\`\`\`\n\nShall I explain overlay networking for production?`
  }

  if (lowerMsg.includes('kubernetes') || lowerMsg.includes('k8s')) {
    return `Kubernetes is a vast topic! Let me give you a structured overview:\n\n**Control Plane:**\n- API Server (entry point)\n- etcd (state store)\n- Scheduler (assigns pods to nodes)\n- Controller Manager (reconciliation loops)\n\n**Worker Nodes:**\n- kubelet (agent)\n- kube-proxy (network rules)\n- Container Runtime (containerd/CRI-O)\n\n**For interviews, focus on:**\n1. Pod lifecycle and health probes\n2. Service types and networking\n3. Deployment strategies\n4. RBAC and security contexts\n\nWhat specific K8s topic would you like to explore?`
  }

  return `That is a great question about system administration! Let me help you understand this better.\n\n**Here is my approach:**\n1. Break down the problem into core concepts\n2. Understand the \"why\" behind the technology\n3. Practice with hands-on examples\n4. Review common interview questions on this topic\n\nCould you be more specific about which aspect you would like me to explain? For example:\n- Theoretical concepts\n- Practical commands and configuration\n- Troubleshooting scenarios\n- Interview preparation tips\n\nI am here to guide your learning journey!`
}

function generateInterviewResponse(message: string, context?: string): string {
  const lowerMsg = message.toLowerCase()

  if (lowerMsg.length < 20) {
    return `Your answer is quite brief. In an interview, you would want to elaborate more. Here are some tips:\n\n1. **Start with a definition** - Show you understand the concept\n2. **Give a practical example** - Demonstrate hands-on experience\n3. **Mention edge cases** - Show depth of knowledge\n4. **Connect to business impact** - Show you think beyond tech\n\nTry expanding your answer with more detail!`
  }

  if (lowerMsg.length < 50) {
    return `Your answer has the right direction but needs more depth. Here is how to improve:\n\n**Score: 5/10**\n\n**Strengths:** You identified the key concept\n**Improvements needed:**\n- Add specific examples or commands\n- Explain the \"why\" not just the \"what\"\n- Mention alternatives and trade-offs\n\nTry answering again with more detail!`
  }

  return `Good answer! You demonstrate solid understanding.\n\n**Score: 8/10**\n\n**Strengths:**\n- Clear explanation of the concept\n- Good use of examples\n- Shows practical experience\n\n**To make it perfect:**\n- Mention performance implications\n- Discuss failure scenarios\n- Add monitoring/debugging approach\n\nKeep up the great work! You are well-prepared for interviews.`
}

function generateExplanationResponse(message: string, context?: string): string {
  return `Let me explain this in detail:\n\n**For Beginners:**\nThis is a fundamental concept in system administration. Think of it as the foundation that more complex systems are built upon.\n\n**For Intermediate Level:**\nThe key components work together to provide reliable service. Understanding their interactions is crucial for troubleshooting and optimization.\n\n**For Advanced Level:**\nAt this level, you should focus on the internal mechanisms, performance tuning, and architectural decisions. Consider the trade-offs involved in different approaches.\n\n**Real-World Application:**\nIn production environments, this knowledge directly impacts system reliability and your ability to respond to incidents quickly.\n\nWould you like me to dive deeper into any specific aspect?`
}
