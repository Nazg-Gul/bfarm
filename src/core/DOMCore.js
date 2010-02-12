/**
 * Copyright (C) 2010 Sergey I. Sharybin
 */

/**
 * Create new DOM element
 */
function createElement (element)
{
  return document.createElement (element);
}

/**
 * Move all nodes from source to destination
 */
function moveAllNodes (src, dst)
{
  while (src.childNodes.length)
  {
    var node = src.childNodes[0];
    src.removeChild (node);
    dst.appendChild (node);
  }
}

/**
 * Create link with void href
 */
function voidLink(content, opts)
{
  var result = createElement ('A');

  result.href = 'JavaScript:Void(0)';

  $(result).click (function () {
      if (!this.canFocus)
        {
          this.blur ();
        }
    });

  if (typeof content == 'string')
    {
      result.innerHTML = content;
    }
  else
    {
      result.appendChild (content);
    }

  if (opts)
    {
      result.canFocus = defVal (opts['canFocus'], true);
    }

  return  result;
}
