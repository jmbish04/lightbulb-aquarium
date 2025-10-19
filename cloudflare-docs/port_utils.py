"""
Port utility functions for clearing ports before starting the FastAPI server.
Uses psutil for cross-platform compatibility.
"""

import psutil
import os
import signal
import sys
from typing import List, Tuple


def kill_on_port(port: int, force: bool = False) -> List[Tuple[int, str]]:
    """
    Kill any process listening on `port` (TCP). Uses psutil, not lsof.
    
    Args:
        port: The port number to clear
        force: If True, uses SIGKILL; if False, uses SIGTERM
    
    Returns:
        List of (pid, name) tuples of killed processes.
    """
    killed = []
    
    try:
        for conn in psutil.net_connections(kind='inet'):
            # We look for LISTENing sockets on that port
            if conn.status == psutil.CONN_LISTEN and conn.laddr.port == port:
                pid = conn.pid
                if pid is None:
                    continue
                try:
                    proc = psutil.Process(pid)
                    name = proc.name()
                    sig = signal.SIGKILL if force else signal.SIGTERM
                    proc.send_signal(sig)
                    killed.append((pid, name))
                    print(f"Killed process {name} (PID {pid}) on port {port}")
                except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                    print(f"Failed to kill PID {pid}: {e}")
                except Exception as e:
                    print(f"Unexpected error killing PID {pid}: {e}")
    except Exception as e:
        print(f"Error scanning connections: {e}")
    
    return killed


def is_port_available(port: int) -> bool:
    """
    Check if a port is available (not in use).
    
    Args:
        port: The port number to check
        
    Returns:
        True if port is available, False if in use
    """
    try:
        for conn in psutil.net_connections(kind='inet'):
            if conn.status == psutil.CONN_LISTEN and conn.laddr.port == port:
                return False
        return True
    except Exception as e:
        print(f"Error checking port {port}: {e}")
        return False


def clear_port_and_start(port: int = 8001, force: bool = True) -> None:
    """
    Clear the specified port and prepare for FastAPI startup.
    
    Args:
        port: The port to clear (default: 8001)
        force: Whether to force kill processes (default: True)
    """
    print(f"🔍 Checking port {port}...")
    
    if is_port_available(port):
        print(f"✅ Port {port} is available")
        return
    
    print(f"⚠️  Port {port} is in use, clearing...")
    killed = kill_on_port(port, force=force)
    
    if killed:
        print(f"🔄 Killed {len(killed)} process(es) on port {port}")
        # Wait a moment for processes to clean up
        import time
        time.sleep(1)
        
        # Verify port is now clear
        if is_port_available(port):
            print(f"✅ Port {port} is now available")
        else:
            print(f"❌ Port {port} may still be in use")
    else:
        print(f"🤔 No processes found on port {port} (may have cleared automatically)")


if __name__ == "__main__":
    # Command line usage
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8001
    force = "--force" in sys.argv or "-f" in sys.argv
    
    print(f"🚀 Clearing port {port}...")
    clear_port_and_start(port, force)
