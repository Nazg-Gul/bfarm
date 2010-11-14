#!/usr/bin/env python
# -*- coding: utf-8 -*-
#
# ***** BEGIN GPL LICENSE BLOCK *****
#
# This program is free software; you can redistribute it and/or
# modify it under the terms of the GNU General Public License
# as published by the Free Software Foundation; either version 2
# of the License, or (at your option) any later version.
#
# This program is distributed in the hope that it will be useful,
# but WITHOUT ANY WARRANTY; without even the implied warranty of
# MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
# GNU General Public License for more details.
#
# You should have received a copy of the GNU General Public License
# along with this program; if not, write to the Free Software  Foundation,
# Inc., 51 Franklin Street, Fifth Floor, Boston, MA 02110-1301, USA.
#
# The Original Code is Copyright (C) 2010 by Sergey Sharybin <g.ulairi@gmail.com>
# All rights reserved.
#
# The Original Code is: all of this file.
#
# Contributor(s): none yet.
#
# ***** END GPL LICENSE BLOCK *****
#

import time, socket, sys, os

import Logger

from config import Config
import client
from SignalThread import SignalThread
from client.RenderTaskSpawner import spawnNewTask
from client.TaskSender import TaskSender

class RenderNode(SignalThread):
    """
    Render node implementation
    """

    def __init__(self):
        """
        Initialize render node
        """

        SignalThread.__init__(self, name = 'RenderNodeThread')

        self.stop_flag  = False
        self.uuid        = None
        self.currentTask = None

        self.taskSender = TaskSender()

    def getUUID(self):
        """
        Get node's UUID
        """

        return self.uuid

    def requestStop(self):
        """
        Stop server
        """

        self.stop_flag = True

    def isStopped(self):
        """
        Check if server shutted down
        """

        return self.stop_flag

    def register(self):
        """
        Register node at server
        """

        if self.uuid is not None:
            return

        proxy = client.Client().getProxy()

        try:
            self.uuid = proxy.node.register()
            Logger.log('Registered at server under uuid {0}' . format(self.uuid))
        except socket.error as strerror:
            Logger.log('Error registering self: {0}'. format (strerror))
        except:
            Logger.log('Unexpected error: {0}' . format(sys.exc_info()[0]))
            raise

    def unregister(self):
        """
        Unregister node from renderfarm server
        """

        proxy = client.Client().getProxy()

        try:
            proxy.node.unregister(self.uuid)
            self.uuid = None
            Logger.log('Node unregisered')
        except socket.error as strerror:
            Logger.log('Error registering self: {0}'. format (strerror))
        except:
            Logger.log('Unexpected error: {0}' . format(sys.exc_info()[0]))
            raise

    def touch(self):
        """
        Touch server to tell we're still alive
        """

        # Ensure we're registered at serevr
        self.register()

        if self.uuid is None:
            return

        proxy = client.Client().getProxy()

        try:
            proxy.node.touch(self.uuid)
        except socket.error as strerror:
            Logger.log('Error touching server: {0}'. format (strerror))
        except:
            Logger.log('Unexpected error: {0}' . format(sys.exc_info()[0]))
            raise

    def requestTask(self):
        """
        Request task from server
        """

        # Ensure we're registered at serevr
        self.register()

        if self.uuid is None:
            return

        if self.currentTask is not None:
            # Already got task
            return

        proxy = client.Client().getProxy()

        try:
            options = proxy.job.requestTask(self.uuid)
            if options:
                Logger.log('Got new task {0} for job {1}' . format(options['task'], options['jobUUID']))
                self.currentTask = spawnNewTask(options)
        except socket.error as strerror:
            Logger.log('Error requesting task: {0}'. format (strerror))
        except:
            Logger.log('Unexpected error: {0}' . format(sys.exc_info()[0]))
            raise

    def sendRenderedImage(self):
        """
        Send rendered image to selver
        """

        self.taskSender.sendTask(self.currentTask)

        self.currentTask = None

    def run(self):
        """
        Main cycle of render node
        """

        Logger.log('Started main render node thread')

        self.taskSender.start()

        last_touch_time = last_request_time = time.time()
        first_time = True

        while not self.stop_flag:
            cur_time = time.time()

            if first_time or cur_time - last_touch_time >= Config.client['touch_interval']:
                self.touch()
                last_touch_time = cur_time

            if first_time or cur_time - last_request_time >= Config.client['job_request_interval']:
                self.requestTask()
                last_request_time = cur_time

            if self.currentTask is not None:
                if not self.currentTask.isAlive():
                    if not self.currentTask.isFinished():
                        self.currentTask.start()
                    else:
                        self.sendRenderedImage()

                        # Request next task just after render finish
                        # it should save a bit of time
                        self.requestTask()
                        last_request_time = cur_time

            first_time = False

            time.sleep(0.2)

        # Wait all tasks to be sent to server
        self.taskSender.requestStop()
        self.taskSender.join()

        # Unregister
        self.unregister()

        Logger.log('Main render node thread was stopped')
