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

import time, os, threading

from Hash import md5_for_file
from config import Config

import Logger

class RenderJob:
    """
    Render job descriptor
    """

    total_jobs = 0

    TASK_NONE, TASK_RUNNING, TASK_DONE = range(3)

    def __init__(self, options):
        """
        Initialize job descriptor
        """

        self.uuid    = str(RenderJob.total_jobs)
        self.time    = time.time()

        self.storage_fpath = os.path.join(Config.server['storage_path'], 'job-' + self.uuid)

        self.blendRequired = False
        self.blendReceived = False

        self.job_type    = options['type']

        if self.job_type == 'anim':
            self.start_frame = options['start-frame']
            self.end_frame   = options['start-frame']
        else:
            # XXX: ...
            pass

        self.fname = options.get('fname')
        self.fname_path = None

        # get base and full .blend file name
        if self.fname:
            if self.fname.startswith('file://'):
                self.blend_name    = self.fname[7:]
                self.blend_path    = os.path.join(self.storage_fpath, self.blend_name)
                self.blendRequired = True

        self.ntasks = 0
        if self.job_type == 'anim':
            # task for each frame
            self.ntasks = int(options['end-frame']) - int(options['start-frame']) + 1
        else:
            # XXX: need better detection of still parts
            self.ntasks = 9

        self.tasks = [RenderJob.TASK_NONE] * self.ntasks
        self.tasks_remain = self.ntasks

        self.task_lock = threading.Lock()

        # steup storage directory structure
        self.prepareStorage()

        RenderJob.total_jobs += 1

    def getUUID(self):
        """
        Get UUID of job
        """

        return self.uuid

    def getTime(self):
        """
        Get time of registration
        """

        return self.time

    def getBlendChunk(self, chunk_nr):
        """
        Get chunk of .blend file
        """

        try:
            statinfo = os.stat(self.blend_path)
        except OSError:
            return None

        offset = chunk_nr * Config.server['chunk_size']

        if offset > statinfo.st_size:
            return None

        with open(self.blend_path, 'rb') as handle:
            if handle is None:
                return None

            handle.seek(offset)
            chunk = handle.read(Config.server['chunk_size'])
            handle.close()

            return chunk

    def getBlendChecksum(self):
        """
        Get checksum for .blend file
        """

        if self.blend_path is None:
            return ''

        return md5_for_file(self.blend_path)

    def _putFileChunk(self, fpath, chunk, chunk_nr):
        """
        Put chunk to specified file
        """

        mode = 'wb'
        if chunk_nr > 0:
            mode = 'ab'

        with open(fpath, mode) as handle:
            if handle is None:
                return False

            handle.seek(0, os.SEEK_END)
            handle.write(chunk)

            return True

    def putBlendChunk(self, chunk, chunk_nr):
        """
        Put chunk of source .blend file
        """

        if chunk_nr == 0:
            Logger.log('Job {0}: begin receiving .blend file {1}' . format(self.uuid, self.blend_name))

        with self.task_lock:
            if chunk_nr == -1:
                Logger.log('Job {0}: .blend file {1} fully received' . format(self.uuid, self.blend_name))
                self.blendReceived = True
                return True

        return self._putFileChunk(self.blend_path, chunk, chunk_nr)

    def putRenderChunk(self, fname, chunk, chunk_nr):
        """
        Put chunk of rendered file
        """

        if chunk_nr == 0:
            Logger.log('Job {0}: begin receiving rendered image {1}' . format(self.uuid, fname))

        if chunk_nr == -1:
            Logger.log('Job {0}: rendered image {1} fully received' . format(self.uuid, fname))
            return True

        fpath = os.path.join(self.storage_fpath, 'out', fname)
        return self._putFileChunk(fpath, chunk, chunk_nr)

    def _makeDir(self, fpath):
        """
        Setup render output directory
        """

        if not os.path.isdir(fpath):
            try:
                os.mkdir(fpath)
            except:
                raise

    def prepareStorage(self):
        """
        Setup storage directory
        """

        out_fpath = os.path.join(self.storage_fpath, 'out')

        self._makeDir(self.storage_fpath)
        self._makeDir(out_fpath)

    def requestTask(self):
        """
        Request task for render node
        """

        with self.task_lock:
            if self.blendRequired and not self.blendReceived:
                # .blend file is needed and hasn't been received yet
                return None

            if self.tasks_remain == 0:
                return None

            for x in range(self.ntasks):
                if self.tasks[x] == RenderJob.TASK_NONE:
                    self.tasks[x] = RenderJob.TASK_RUNNING

                    # Common options
                    options = {'jobUUID': self.uuid,
                               'task'   : x,
                               'ntasks' : self.ntasks,
                               'type'   : self.job_type,
                               'fname'  : self.fname}

                    # Job-type specified options
                    if self.job_type == 'anim':
                        options['start-frame'] = self.start_frame
                        options['end-frame']   = self.end_frame
                    else:
                        # XXX: ...
                        pass

                    return options

            return None

    def taskComplete(self, task_nr):
        """
        Mark specified task as DONE
        """

        with self.task_lock:
            Logger.log('Job {0}: task {0} completed' . format(self.uuid, task_nr))

            self.tasks[task_nr] = RenderJob.TASK_DONE
            self.tasks_remain -= 1

            if self.tasks_remain == 0:
                Logger.log('Job {0} completed' . format(self.uuid))

        return True

    def isCompleted(self):
        """
        Check if job is completed
        """

        return self.tasks_remain == 0
